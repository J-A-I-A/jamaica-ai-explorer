# Prompt cache probe

Answers one question empirically: **does this endpoint reuse my prompt prefix, and does it tell me?**

Built for the Foundry deployment behind the policy explorer's `/api/chat`, whose ~4,900-token
system prompt is re-sent on every turn. Works against any OpenAI-compatible endpoint.

Documentation for non-OpenAI models on Foundry is thin and contradictory, so this measures the
behaviour instead of trusting it.

## Run it

```bash
pip install -r requirements.txt
cp .env.example .env      # fill in OPENAI_BASE_URL, MODEL, MODEL_API_KEY
pytest
```

Output ends with a verdict and a written report:

```
============================= PROMPT CACHE VERDICT =============================
PREFIX CACHING ACTIVE
report: reports/latest.md
```

Without a `.env` the billable tests skip and the offline unit tests still run, so `pytest` is
always safe to execute.

## Corpus sizing is measured, not assumed

Prefix caching does nothing below roughly 1,024 tokens, so a probe corpus that lands under that
floor produces a cache miss that proves nothing — and looks exactly like "this endpoint doesn't
cache".

That happened. The corpora were sized from a hardcoded 3.6 characters per token, but the deployment
bills this filler at ~5.3, because repetitive everyday English compresses far better than mixed
prose. A corpus aimed at 1,200 tokens arrived as **815**.

So the suite now measures the ratio instead. One small call at the start of the run:

```
| calibration | ?? | 1545 chars billed as 290 tokens (5.33 chars/token, using 5.25) |
```

Every corpus is sized from that figure. The measurement is **quantised to 0.25** before use —
without that, a one-token difference between runs would change the corpus text, and a corpus that
changes between runs cannot test a cache that persists between runs. An implausible ratio (outside
2.0–9.0) is rejected in favour of the default, on the grounds that the endpoint is reporting
something we do not understand.

Four unit tests cover this, including one that walks plausible ratios from 3.0 to 7.0 and fails if
the default target would fall under the floor at any of them.

## Content filter: why the filler is boring prose

The synthetic corpora read like minutes from a very dull committee:

```
Paragraph 1. The training division noted the progress report for inclusion in the next update.
Paragraph 2. The advisory board documented the staffing plan following the earlier consultation.
```

That is deliberate. The first version generated filler from a chain of SHA-256 digests — good for
determinism, but Azure's content filter classified it as a **`Jailbreak`** attempt and rejected the
request with a 400, because a long run of high-entropy characters is exactly what an obfuscated
payload looks like. Prefix caching keys on bytes, not meaning, so dull prose measures the same thing
without tripping the classifier.

Two unit tests hold that line: one fails if the filler grows alphanumeric runs longer than 16
characters or a suspiciously high unique-word ratio, the other if it ever contains instruction-like
phrasing (`ignore`, `system prompt`, `you are`). If someone reaches for hashes again for
determinism, they get told why not.

If the filter does reject something, the run no longer dies. `ContentFilteredError` is caught, the
block is recorded as a finding, and only the tests that depended on that prompt are skipped:

```
| content_filter_blocked | ERR | filter label 'Jailbreak' rejected the prompt |
```

Worth knowing: **a filtered prompt is still billed and still counts against TPM**, so the pacer
charges it to the ledger. And if the filter ever blocks the *real* system prompt rather than the
synthetic filler, that is a production finding — the same filter sits in front of `/api/chat`.

## Staying inside a 20,000 TPM quota

The deployment this was written for has **20,000 tokens per minute**. The suite spends roughly
24,000 tokens, so run flat out it would trip `429 RateLimitReached` — which is what happened before
pacing existed.

Two mechanisms now keep it inside the quota:

**A token-budget pacer** (`cache_probe/pacing.py`) keeps a rolling 60-second ledger. Before each
call it reserves an estimate and sleeps if that reservation would breach the limit; once the
response arrives it replaces the estimate with the count the endpoint actually reported, so the
ledger stays accurate over a long run instead of drifting.

**429 retry with `Retry-After`** as a backstop. The quota window is shared with anything else
hitting the deployment — your dev server, a colleague — so our ledger can only ever approximate it.
A 429 is waited out and retried rather than failing the run: a quota collision is not a finding
about caching.

Measured against a mock enforcing the quota, the difference is stark:

| | 429s hit | Result |
| --- | --- | --- |
| Pacing off | 3 | Passes, but only because the retry logic absorbed the rejections |
| Pacing on | **0** | Passes cleanly; 3 planned pauses, peak window well under the limit |

Expect the full suite to take **roughly 1.5–2 minutes** against a 20,000 TPM deployment. That is the
pacer working, not the suite hanging — the run prints what it waited for at the end:

```
- Quota: 20,000 TPM budget; paused 2 time(s) for 6s total; peak window 18,070 tokens
```

Tuning:

```bash
pytest --tpm 50000     # after a quota increase
pytest --tpm 0         # disable pacing (local model, no quota)
```

`TPM_LIMIT` in `.env` does the same thing and defaults to 20,000.

**The suite was also trimmed to fit.** Synthetic corpora sit just above the 1,024-token caching
floor rather than well above it, and each module now primes the cache once and reads from that
single write instead of re-writing per test. The expensive module — the one carrying the real
4,900-token system prompt — makes three calls instead of five. Every original check survives; the
redundancy is what went.

## Getting a 401?

```
401: Access denied due to invalid subscription key or wrong API endpoint.
```

Azure returns that same message whether the key is wrong, the **header name** is wrong, or the
host/path is wrong — three very different problems behind one string. Don't guess:

```bash
python scripts/diagnose_auth.py
```

It sweeps the plausible URL shapes against each auth header, prints which combination returns 200,
and hands you the exact `.env` lines to paste. Keys are redacted in its output. Each probe sends a
two-token prompt, so a whole sweep costs less than one normal request.

If nothing succeeds, the usual cause is a key/endpoint mismatch: in the Foundry portal, open the
**deployment** and copy the URL and key shown together on that page. A project-level key, or a key
from a neighbouring resource, fails with exactly this message.

Note that the client sends **one** auth header at a time. Sending `Authorization: Bearer` and
`api-key` together looks harmless but isn't — some Azure front doors see the Bearer header, try to
validate it as an Entra ID token, and reject the request without ever reading `api-key`. On
`AUTH_STYLE=auto` a 401 triggers one retry per alternative header, and whichever works is reused for
the rest of the run.

## What it checks

| Test file | Establishes |
| --- | --- |
| `test_00_unit_usage.py` | The detector itself is correct — offline, no network, no cost |
| `test_00_unit_pacing.py` | The TPM pacer is correct — offline, on a fake clock, nothing sleeps |
| `test_01_connectivity.py` | The endpoint answers and reports token usage at all |
| `test_02_fields.py` | Which cache fields it speaks; a fresh nonce is genuinely a miss |
| `test_03_prefix.py` | Identical prefix hits; suffix-only change still hits; prefix change busts |
| `test_04_real_prompt.py` | The actual shipped system prompt caches, including as history grows |
| `test_05_thresholds.py` | Sub-1,024-token prompts; optional cache-lifetime probe |

The ordering is deliberate. `test_02` refuses to trust a positive result unless a prompt containing
a fresh UUID comes back as a **miss** — if that "hits", the endpoint is reporting something other
than prefix reuse and every later number is noise.

`test_03` separates prefix caching from whole-response caching by varying only the user turn. That
distinction is the one that matters in production: your system prompt is fixed, the visitor's
question never is.

## No caching found is a result, not a failure

The suite reports rather than fails. "This endpoint does not cache" is the finding you'd be paying
to discover, and a red build would obscure it. Safe to run on a schedule as a monitor — if Foundry
enables caching for your model later, the verdict flips on its own.

Pass `--strict-cache` to invert that and hard-fail on a missing cache hit, once you know caching
works and want CI to catch a regression.

## Options

| Flag | Default | Purpose |
| --- | --- | --- |
| `--strict-cache` | off | Turn cache-hit findings into hard failures |
| `--warmup-delay=SEC` | `2.0` | Pause between the cache-writing and cache-reading call |
| `--retention-wait=SEC` | `0` (skip) | Idle this long, then re-probe, to measure cache lifetime |
| `--tpm=N` | `20000` | Tokens-per-minute quota to stay under; `0` disables pacing |

Environment: `OPENAI_BASE_URL`, `MODEL`, `MODEL_API_KEY`, plus optional `AUTH_STYLE`
(`auto` | `api-key` | `bearer` | `subscription-key`), `OPENAI_API_VERSION`, `TPM_LIMIT`, and
`PACING_WINDOW_SECONDS` (default 60 — only change it if your provider's quota window differs).

Measuring retention:

```bash
pytest tests/test_05_thresholds.py --retention-wait=400   # ~7 min
```

A hit after ~7 minutes of silence means extended retention; a miss means a short-lived in-memory
cache, which matters a lot for a public site with sporadic traffic.

## Field-name handling

Providers disagree on what to call this. The normaliser in `cache_probe/usage.py` understands:

```
usage.prompt_tokens_details.cached_tokens      OpenAI / Azure OpenAI
usage.prompt_cache_hit_tokens                  DeepSeek native
usage.cache_read_input_tokens                  Anthropic-style proxies
usage.cached_tokens                            assorted gateways
```

…and deep-scans the raw usage object for anything else cache-shaped, so a provider using a name
nobody has published still surfaces in the report. It reads the **raw JSON body**, not a parsed SDK
model, because typed clients silently drop fields they don't recognise — which is precisely the
case that matters here.

It also handles miss-only reporting: if an endpoint publishes only `prompt_cache_miss_tokens` and
that number is below `prompt_tokens`, the remainder was served from cache.

## Verifying the probe before spending money

`scripts/mock_endpoint.py` is a fake OpenAI-compatible server that simulates prefix caching, so you
can confirm the detection logic works before pointing it at a billable deployment.

```bash
python scripts/mock_endpoint.py --dialect deepseek --port 8099 &
OPENAI_BASE_URL=http://127.0.0.1:8099/v1 MODEL=mock MODEL_API_KEY=x pytest --warmup-delay=0
```

Flags, each reproducing a failure mode seen against the real deployment:

| Flag | Simulates |
| --- | --- |
| `--dialect` | Field naming: `openai`, `deepseek`, `anthropic`, `exotic` (an invented name), `none` |
| `--no-cache` | A provider that never reuses a prefix |
| `--chars-per-token` | A denser tokeniser — use `5.5` to match the real DeepSeek deployment |
| `--tpm` / `--window` | A TPM quota, answering 429 with `Retry-After` above it |
| `--content-filter` | Azure's `Jailbreak` 400 on high-entropy prompts |

Five scenarios are checked after every change to the suite, and all five produce the right verdict:

```
realistic tokeniser (5.5)   PREFIX CACHING ACTIVE
quota enforced + paced      PREFIX CACHING ACTIVE          (0 × 429)
content filter active       PREFIX CACHING ACTIVE
endpoint never caches       CACHE FIELDS PRESENT BUT NO HITS OBSERVED
no telemetry at all         NO CACHE TELEMETRY
```

## Cost

Twelve requests, about 24k prompt tokens, with output capped at 16–32 tokens per call since only
input accounting is under test. Cheap on any per-token model — but it is real spend against a real
deployment, hence the `costs_tokens` marker:

```bash
pytest -m "not costs_tokens"    # offline only
```

## The fixture

`fixtures/system_prompt.txt` is a verbatim export of `ASSISTANT_SYSTEM_PROMPT` from
`jamaica-ai-explorer/src/data/documentContext.ts` (3,517 words / 4,899 tokens at time of export).

It will drift as the policy content changes. That doesn't invalidate the mechanism tests, but
re-export it before drawing conclusions about production:

```bash
cd ../jamaica-ai-explorer
node --experimental-strip-types -e "
  import('./src/data/documentContext.ts').then(m =>
    require('fs').writeFileSync(
      '../prompt-cache-tests/fixtures/system_prompt.txt',
      m.ASSISTANT_SYSTEM_PROMPT))"
```

If that errors on the `server-only` import, strip that line from a temporary copy first.

## Reading the verdict

| Verdict | Meaning |
| --- | --- |
| `PREFIX CACHING ACTIVE` | Confirmed reuse, confirmed prefix-keyed. Keep the prompt stable and monitor the reported field. |
| `CACHING ACTIVE (prefix reuse unconfirmed)` | Repeats hit, but suffix variation didn't — possibly response caching, not prefix caching. |
| `CACHE FIELDS PRESENT BUT NO HITS OBSERVED` | The endpoint knows the concept but reused nothing. Check minimum size, deployment tier, and whether the cache needs warm-up traffic. |
| `NO CACHE TELEMETRY` | Nothing cache-shaped anywhere in usage. Assume full input billing on every request. |
