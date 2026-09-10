# National A.I. Policy Explorer — Jamaica

An interactive Next.js site built around *National Artificial Intelligence — Policy Recommendations*,
prepared by Jamaica's National Artificial Intelligence Task Force and presented to the Office of the
Prime Minister.

## Run it

```bash
yarn install
yarn run dev      # http://localhost:3000
```

Production build:

```bash
yarn run build && yarn start
```

## Configuration

Every setting is read from the environment **at runtime**. Nothing is inlined at
build time, so a single Docker image can be built once and promoted across
environments by changing environment variables alone — no rebuild, no republish.
Copy `.env.example` to `.env.local` for local development.

| Variable | Used by | Notes |
| --- | --- | --- |
| `MODEL_API_KEY` / `OPENAI_BASE_URL` / `MODEL` | `/api/chat` | Any OpenAI-compatible endpoint. Absent, the assistant returns 503. |
| `PRIVACY_DOC_URL` (+ `PRIVACY_DOC_CACHE_SECONDS`) | `/privacy` | Share URL of the Google Doc holding the privacy policy. Absent, the page says the policy isn't published yet. |
| `ASSISTANT_DATA_PROCESSOR` / `ASSISTANT_PRIVACY_NOTICE` | `/assistant` | The privacy line under the chat composer. Names the processor (default `Microsoft`), or replaces the whole sentence. |
| `FEEDBACK_SUBMISSIONS_OPEN` | `/feedback`, `/api/feedback` | Master switch for accepting submissions. `true` opens the consultation. **Unset means closed.** |
| `RECAPTCHA_SITE_KEY` | `/feedback` | Public reCAPTCHA v2 site key. Read server-side and passed to the form as a prop. Absent, the checkbox is not rendered. |
| `RECAPTCHA_SECRET_KEY` | `/api/feedback` | Server-side verification secret. **Absent in production, the API logs an error and refuses submissions**; in development it warns and accepts them. |
| `POSTGRES_URL` (+ `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_SSL`) | `/api/feedback` | The only place feedback is ever stored. Absent, the API refuses submissions up front — nothing is written anywhere. |
| `FEEDBACK_RATE_LIMIT` / `FEEDBACK_RATE_WINDOW_HOURS` | `/api/feedback` | Submissions allowed per address per rolling window. Defaults to 10 per hour; `FEEDBACK_RATE_LIMIT=0` turns the limit off. |
| `CHAT_RATE_LIMIT` / `CHAT_RATE_WINDOW_HOURS` | `/api/chat` | Questions answered per address per rolling window. Defaults to 15 per 24 hours; `CHAT_RATE_LIMIT=0` turns the limit off. |

Set `RECAPTCHA_SITE_KEY` and `RECAPTCHA_SECRET_KEY` together. With only the
secret set the form has no checkbox to complete and every submission is
rejected; with only the site key set, production refuses submissions anyway.

### Opening and closing the consultation

`FEEDBACK_SUBMISSIONS_OPEN` decides whether the site is collecting feedback. It
accepts `true` / `false` (and `1`/`0`, `yes`/`no`, `on`/`off`, `open`/`closed`).

While it is off, the form still renders — so people can read what will be asked
and prepare a response — but the submit button is disabled and relabelled, the
reCAPTCHA widget never mounts, and `/api/feedback` rejects posts with a `503`.
**The API check is the control; the disabled button is a courtesy.** Turning the
switch off stops submissions even from a client that ignores the UI.

Two deliberate choices:

- **Unset means closed.** A fresh environment, or a forgotten value during a
  migration, must not open a national consultation by accident. Opening one is
  something you have to say out loud.
- **An unrecognised value is closed, loudly.** A typo would otherwise silently
  decide whether the consultation is running, so the server logs a warning once
  and falls back to closed.

It is read from the environment rather than compiled in because this is the one
setting most likely to be flipped by someone who is not a developer, at a moment
that isn't convenient — a consultation opens when it is announced. That makes it
a restart, not a rebuild and a redeploy. Like the reCAPTCHA site key, it reaches
the form as a prop from the page rather than as a `NEXT_PUBLIC_*` value, which
would pin it to the built image.

### The privacy policy lives in a Google Doc

`/privacy` renders its content from a Google Doc written in Markdown, rather
than from a file in this repository. The policy is the one piece of copy on the
site that a lawyer or a communications officer needs to change without a
developer, a pull request or a deploy — so it lives where they already work, and
the site picks up edits on the next cache expiry.

**Setting it up:**

1. In a new Google Doc, turn on **Tools → Preferences → Enable Markdown**, then
   paste in `docs/privacy-policy-template.md`. The whole file is safe to paste —
   it contains the policy text with `[BRACKETED]` placeholders to fill in, and
   one clearly-marked block to delete.

   Enabling Markdown first is what turns the `##` and `-` into real Docs
   headings and bullets. **Paste without it and Docs keeps the Markdown as
   literal text**, escaping every character on export (`\#\# Who we are`) and
   putting a hard line break at the end of every wrapped line. The site
   unescapes that so the page still reads correctly, but the document itself
   ends up a wall of plain text that nobody can comfortably edit — which defeats
   the point of keeping it in a Doc. If a doc is already in that state, select
   all, delete, and re-paste with the preference on.
2. Share it: **Share → General access → Anyone with the link → Viewer**. This is
   what lets the site read it without any API key, OAuth client or service
   account.
3. Copy the link from the address bar and set `PRIVACY_DOC_URL` to it, as-is —
   the `/edit?tab=…` suffix and any `#heading` fragment are fine, and a bare
   document id is accepted too.

**How it reads the doc.** Google serves any link-shared doc as Markdown from its
export endpoint (`/export?format=md`), so `src/lib/privacyDoc.ts` is a plain
`fetch` — no Google API client is involved. The Markdown is then rendered by the
same `<Markdown>` component the assistant uses, so a policy gets the site's
typography, tables and link handling for free. Raw HTML in the doc is **not**
rendered, so nothing in the document can inject markup into the page.

Two details worth knowing when writing the doc:

- **The first `# Heading` is dropped**, because the page already prints "Privacy
  Policy" in its header. Start the doc with its own title and it won't appear
  twice.
- **Ordinary Google Docs formatting works** — headings, bold, bullets, numbered
  lists, tables and links all survive the Markdown export. You do not have to
  type Markdown syntax by hand, and shouldn't: format the document the way you
  would any other, and the export takes care of itself.
- **A line break inside a paragraph is preserved** as a line break on the page.
  Use a new paragraph for a new paragraph; reserve Shift+Enter for places where
  you actually want the text to break, such as a postal address.

| Variable | Effect |
| --- | --- |
| `PRIVACY_DOC_URL` | The document's share URL, copied from the address bar. A bare document id also works. Unset, `/privacy` explains the policy isn't published yet. |
| `PRIVACY_DOC_CACHE_SECONDS` | How long a fetched copy is served before Google is asked again. Defaults to 300 (5 minutes). |

The fetch follows Google's redirect: a successful export is not served from
`docs.google.com` but from its content domain, so the response lands on a
`*.googleusercontent.com` host. Both are accepted. A redirect to
`accounts.google.com` — what an unshared document gives you — is not, and
neither is a lookalike such as `evilgoogleusercontent.com`.

Only the document id is taken from that URL, and only after it is validated;
the URL actually fetched is always rebuilt from a fixed template inside
`src/lib/privacyDoc.ts`. So the environment chooses *which document* is read,
never *which host* is contacted — the same rule the reCAPTCHA verification in
`/api/feedback` follows.

**Failure behaviour is deliberate.** If Google can't be reached, the last good
copy is served rather than an error — a privacy notice is a statement a public
body has made to the public, and a Google outage is a poor reason to withdraw
it. If there is no previous copy, the page says plainly that the policy can't be
loaded and points at the feedback and Smart Search pages, which describe their
own data handling. A doc that isn't shared publicly returns a Google **sign-in
page** with a perfectly healthy `200`; the fetch checks the final host and
content type and rejects that, so a misconfigured share setting can never render
Google's login screen as the privacy policy.

### The assistant's privacy notice

A short notice sits under the chat composer on `/assistant`, because a visitor
typing a question deserves to know their words leave the site before they send
them. By default it reads:

> Questions you ask are processed by **Microsoft** to generate a response.
> Conversations are not stored by this site. Please do not enter personal or
> sensitive information.

Both claims are true of this deployment as written: `/api/chat` forwards the
messages to the model provider and writes nothing to Postgres, and the
conversation lives in React state only, so a refresh discards it. **If you change
the app so that conversations are logged or stored, change this notice too** —
it is a statement to the public, not decoration.

Two variables control it, read per request by `src/app/assistant/page.tsx` and
passed to the client component as a prop:

| Variable | Effect |
| --- | --- |
| `ASSISTANT_DATA_PROCESSOR` | Swaps the name in the default sentence. Defaults to `Microsoft`. |
| `ASSISTANT_PRIVACY_NOTICE` | Replaces the sentence outright, for a deployment that needs its own wording. Wins over `ASSISTANT_DATA_PROCESSOR`. |

The processor is a variable rather than a hard-coded string because `/api/chat`
talks to any OpenAI-compatible endpoint — point `OPENAI_BASE_URL` at Azure,
OpenAI or a self-hosted model and the notice must be able to follow, or it
becomes a false statement to the public. Set `ASSISTANT_DATA_PROCESSOR=OpenAI`
alongside the endpoint change; for a self-hosted model, use
`ASSISTANT_PRIVACY_NOTICE` to say so plainly.

The notice is announced to screen readers as part of the composer's
`aria-describedby`, alongside the accuracy disclaimer, so it is heard before
typing rather than found afterwards.

### Rate limiting

Both write endpoints are rate limited by `src/lib/rateLimit.ts`, a sliding
window held in memory. Hits are stored as timestamps, so the window slides
rather than releasing every caller at a fixed hour, and a caller who spreads
requests out is never punished for a burst an hour ago.

| Endpoint | Default | Scope key |
| --- | --- | --- |
| `/api/feedback` | 10 submissions per hour | `feedback:<address>` |
| `/api/chat` | 15 questions per 24 hours | `chat:<address>` |

The two budgets are **scoped apart**, so a visitor who has used up their
questions to the assistant can still file feedback, and vice versa. The caller
is identified from `x-forwarded-for` (first entry), then `x-real-ip`, then
`cf-connecting-ip`; a caller none of those identify falls into one shared
`unknown` bucket, which is deliberately conservative.

Over the limit the API answers `429` with `Retry-After` and the
`X-RateLimit-Limit` / `-Remaining` / `-Reset` triple. The body carries a
plain-language `error` — *"You've reached the limit of 10 submissions per hour.
Please try again in about 40 minutes."* — which the feedback form and the
assistant both render as-is, so the wording lives in one place. Successful
responses carry the same `X-RateLimit-*` headers.

A slot is checked and spent at two different moments, which is the point worth
knowing when reading the route:

- **Checked** before the request body is parsed, so a flood is refused for
  almost no work.
- **Spent** only once the submission has passed validation and is about to cost
  an outbound reCAPTCHA call and a database write. A respondent who trips a
  validation error keeps their full budget; a bot posting junk reCAPTCHA tokens
  is charged for every attempt, so it cannot keep Google's `siteverify` endpoint
  busy for free.

The feedback default is deliberately looser than the assistant's. An office, a
campus or an ISP behind CGNAT can share a single address during a public
consultation, and a tight per-address cap would silently turn away honest
respondents — reCAPTCHA is the check that stops bots, and this limit only exists
to stop a script flooding the consultation. Set `FEEDBACK_RATE_LIMIT=0` (or
`CHAT_RATE_LIMIT=0`) to turn a limit off entirely; an unset or blank value keeps
the default, and an explicit `0` is honoured.

The state lives in the process, cached on `globalThis` so dev-server hot reloads
don't reset it. Two consequences for production: **the counts reset on deploy**,
and **behind more than one instance each keeps its own count**, so the effective
limit is the configured value times the instance count. That is the accepted
trade-off — the limit caps model spend and casual abuse rather than serving as
an auditable quota, and it keeps both routes free of an extra dependency. If a
hard cap is ever needed, Postgres is already a dependency of `/api/feedback` and
is the place to move the counters.

## Routes

| Route | What it does |
| --- | --- |
| `/` | Hero, vision statement, nine pillars, horizon counts, global themes |
| `/explore` | Interactive explorer — full-text search with match highlighting, multi-select horizon and pillar filters, grouped or flat views |
| `/explore/[slug]` | Detail page per pillar: policy issue, challenges, recommendations grouped by horizon, prev/next navigation |
| `/roadmap` | The recommended action plan as a pillar × horizon matrix; click a horizon to isolate it |
| `/swot` | SWOT analysis; click a quadrant to expand it full-width |
| `/ethics` | Ethical considerations, comparative global themes, references |
| `/task-force` | Chair, the sixteen members, and the mandate |
| `/privacy` | Privacy policy, rendered from a Google Doc written in Markdown |

All nine pillar pages are statically generated via `generateStaticParams`.

## Content model

Everything the site renders lives in two typed data files — no CMS, no fetching:

- `src/data/recommendations.ts` — the nine pillars, each with policy issue, objective, challenges and
  recommendations tagged `short` | `medium` | `long`. Derived exports (`ALL_ACTIONS`, `COUNTS`) power
  the explorer and the stat blocks, so counts can never drift from the content.
- `src/data/context.ts` — SWOT, ethical considerations, global thematic areas, task force roster,
  references.

To amend the policy content, edit those two files; every page, filter and count updates from them.

## Design

Jamaican national palette — black ground, gold (`#ffb400`) as the primary accent, green (`#009b3a`)
as secondary — defined as CSS custom properties in `src/app/globals.css` and exposed to Tailwind v4
via `@theme inline` (`bg-jm-ink`, `text-jm-gold`, and so on). Display type is Space Grotesk, body is
Inter.

## Provenance

Content is transcribed from the source PDF (`../National-Artificial-Intelligence-Task-Force-Policy-Recommendations.pdf`).
Recommendation wording follows the Recommended Action Plan table where the document's body text and
table differ in spelling.
