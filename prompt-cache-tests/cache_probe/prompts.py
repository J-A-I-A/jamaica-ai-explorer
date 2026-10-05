"""Prompt construction for cache probing.

Design rules, all of which exist because prefix caching is fragile:

* A "cold" prefix must be genuinely novel, so it carries a nonce AT THE FRONT.
  A nonce at the end would leave the prefix shared and quietly produce a hit.
* A "warm" prefix must be byte-identical across calls — no timestamps, no
  randomness, no dict iteration order.
* Filler must be deterministic, and must not depend on a tokenizer library: we
  size by characters and let the endpoint's own `prompt_tokens` tell us the
  truth.
* **Filler must read as ordinary prose.** An earlier version built the corpus
  from SHA-256 hex digests, which Azure's content filter classified as a
  `Jailbreak` attempt and rejected with a 400 — a long run of high-entropy
  characters looks exactly like an obfuscated payload. So the filler is now
  built from a small bank of neutral administrative vocabulary, assembled
  deterministically into readable sentences. Prefix caching keys on bytes, not
  meaning, so nothing about the measurement is weakened by using dull prose.
"""

from __future__ import annotations

import hashlib
from pathlib import Path

FIXTURES = Path(__file__).resolve().parent.parent / "fixtures"

# Starting guess only, used before the endpoint has told us anything. It is
# routinely wrong: this filler is repetitive everyday English, which most
# tokenisers compress to ~5.5 chars/token rather than the ~3.6 typical of mixed
# prose. Sizing a corpus from this constant produced an 815-token prompt when
# 1,200 was wanted — below the caching floor, which silently invalidates the
# whole measurement. So we calibrate against the endpoint instead (see
# `calibration_sample` and the `chars_per_token` fixture).
CHARS_PER_TOKEN = 3.6

# Sane bounds for a measured ratio. Anything outside this says the endpoint is
# reporting something other than what we think, so fall back to the constant.
MIN_CHARS_PER_TOKEN = 2.0
MAX_CHARS_PER_TOKEN = 9.0

# Measured ratios are rounded to this step before use. Without quantising, a
# one-token difference between runs would change the corpus text, and a corpus
# that changes between runs cannot test a cache that persists between runs.
CHARS_PER_TOKEN_STEP = 0.25

# Providers will not cache a prefix below ~1,024 tokens. Synthetic corpora sit
# above that floor with enough margin to survive tokeniser differences, and no
# further — on a 20,000 TPM deployment every extra token is wait time.
CACHE_FLOOR_TOKENS = 1024
DEFAULT_CORPUS_TOKENS = 1300


def quantise_ratio(chars_per_token: float) -> float:
    """Round a measured ratio to a coarse step, for run-to-run stability."""
    if not (MIN_CHARS_PER_TOKEN <= chars_per_token <= MAX_CHARS_PER_TOKEN):
        return CHARS_PER_TOKEN
    steps = round(chars_per_token / CHARS_PER_TOKEN_STEP)
    return max(MIN_CHARS_PER_TOKEN, steps * CHARS_PER_TOKEN_STEP)


def calibration_sample() -> str:
    """A fixed sample used to measure the endpoint's chars-per-token ratio.

    Long enough that the chat template's fixed per-message overhead does not
    distort the ratio much, short enough to be nearly free.
    """
    return deterministic_filler(400, seed="calibration-sample-v1")


def load_real_system_prompt() -> str:
    """The actual ASSISTANT_SYSTEM_PROMPT shipped by the policy explorer."""
    path = FIXTURES / "system_prompt.txt"
    if not path.exists():
        raise FileNotFoundError(
            f"{path} is missing. Regenerate it with scripts/export_system_prompt.mjs."
        )
    return path.read_text(encoding="utf-8")


# Deliberately dull, deliberately neutral. Nothing here should interest a
# safety classifier, and nothing should collide with real policy content.
_SUBJECTS = (
    "the working group", "the review panel", "the regional office",
    "the planning committee", "the technical secretariat", "the advisory board",
    "the coordinating unit", "the standards body", "the training division",
    "the records team", "the procurement office", "the evaluation team",
)
_VERBS = (
    "reviewed", "documented", "scheduled", "summarised", "circulated",
    "considered", "approved", "catalogued", "revised", "noted",
    "consolidated", "tabled",
)
_OBJECTS = (
    "the quarterly summary", "the training calendar", "the equipment register",
    "the site survey", "the budget outline", "the maintenance schedule",
    "the staffing plan", "the reporting template", "the archive index",
    "the meeting minutes", "the inventory listing", "the progress report",
)
_TAILS = (
    "before the end of the period",
    "in line with the agreed timetable",
    "for inclusion in the next update",
    "following the earlier consultation",
    "with no further action required",
    "subject to the usual review",
    "as recorded in the previous session",
    "ahead of the scheduled meeting",
)


def _pick(bank: tuple[str, ...], seed: str, counter: int, slot: int) -> str:
    """Deterministic choice: same seed and position always gives the same word.

    Uses an explicit hash rather than `random` so the output cannot shift with a
    Python version change — the warm corpus must be byte-identical forever, or
    it stops being a cache probe.
    """
    digest = hashlib.sha256(f"{seed}|{counter}|{slot}".encode()).digest()
    return bank[int.from_bytes(digest[:4], "big") % len(bank)]


def deterministic_filler(
    target_tokens: int, *, seed: str, chars_per_token: float = CHARS_PER_TOKEN
) -> str:
    """Reproducible neutral prose of roughly `target_tokens` tokens.

    Stable across runs, machines and Python versions, and plain enough that a
    content filter has nothing to react to. Pass a measured `chars_per_token`
    to make the target accurate for a specific endpoint.
    """
    target_chars = int(target_tokens * chars_per_token)
    lines: list[str] = []
    length = 0
    counter = 0
    while length < target_chars:
        sentence = (
            f"Paragraph {counter + 1}. "
            f"{_pick(_SUBJECTS, seed, counter, 0).capitalize()} "
            f"{_pick(_VERBS, seed, counter, 1)} "
            f"{_pick(_OBJECTS, seed, counter, 2)} "
            f"{_pick(_TAILS, seed, counter, 3)}. "
            f"{_pick(_SUBJECTS, seed, counter, 4).capitalize()} also "
            f"{_pick(_VERBS, seed, counter, 5)} "
            f"{_pick(_OBJECTS, seed, counter, 6)}."
        )
        lines.append(sentence)
        length += len(sentence) + 1
        counter += 1
    return "\n".join(lines)


def cold_prefix(
    nonce: str,
    *,
    target_tokens: int = DEFAULT_CORPUS_TOKENS,
    chars_per_token: float = CHARS_PER_TOKEN,
) -> str:
    """A large prompt no cache can have seen, because the nonce leads."""
    header = f"Reference set {nonce}. Working notes, single use.\n\n"
    return header + deterministic_filler(
        target_tokens, seed=nonce, chars_per_token=chars_per_token
    )


def warm_prefix(
    *,
    target_tokens: int = DEFAULT_CORPUS_TOKENS,
    chars_per_token: float = CHARS_PER_TOKEN,
) -> str:
    """A large prompt that is identical on every call and every run.

    Identical only for a given `chars_per_token`, which is why that value is
    quantised before it reaches here — see `quantise_ratio`.
    """
    header = "Reference set: standing notes, version 1.\n\n"
    return header + deterministic_filler(
        target_tokens, seed="stable-corpus-v1", chars_per_token=chars_per_token
    )


def tiny_prefix() -> str:
    """Well under any documented 1,024-token minimum."""
    return (
        "You are a terse assistant. Answer in one short sentence, "
        "using plain language and no preamble."
    )


def messages(system: str, user: str) -> list[dict[str, str]]:
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]
