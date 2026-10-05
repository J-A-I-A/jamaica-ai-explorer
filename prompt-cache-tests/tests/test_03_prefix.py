"""The core question: does an identical leading prefix get reused?

Three experiments, in order of what they prove:

  warm_prefix_hit      sending the same prompt twice produces a hit
  suffix_variation_hit changing only the tail still hits  -> it is PREFIX
                       caching, not whole-request response caching
  prefix_change_busts  changing the first line misses     -> confirms the
                       cache is keyed on the head, as documented

All three read from ONE priming write. Writing the same corpus three times
would spend three times the tokens to establish the same cache entry, which on
a 20,000 TPM deployment translates directly into pacing delay.
"""

from __future__ import annotations

import time

import pytest

from cache_probe.prompts import messages, warm_prefix

pytestmark = pytest.mark.costs_tokens


@pytest.fixture(scope="module")
def warm_corpus(chars_per_token) -> str:
    return warm_prefix(chars_per_token=chars_per_token)


@pytest.fixture(scope="module")
def primed(send, recorder, warm_corpus, warmup_delay):
    """Write the corpus into the cache once; every test below reads from it."""
    call = send(
        messages(warm_corpus, "Reply with the single word: prime."),
        label="warm-write",
    )
    recorder.note_fields(call.usage.discovered)
    # Give the provider a beat to publish the entry. Most are immediate; a few
    # need the write to settle.
    time.sleep(warmup_delay)
    return call


def test_identical_prefix_produces_hit(send, recorder, expect_cache, primed, warm_corpus):
    second = send(
        messages(warm_corpus, "Reply with the single word: prime."),
        label="warm-read",
    )
    recorder.note_fields(second.usage.discovered)

    ratio = second.usage.hit_ratio
    detail = (
        f"write {primed.usage.summary()}; read {second.usage.summary()}"
        + (f"; hit ratio {ratio:.0%}" if ratio is not None else "")
    )
    expect_cache(
        "warm_prefix_hit",
        second.usage.hit,
        detail,
        first=primed.usage.raw,
        second=second.usage.raw,
        hit_ratio=ratio,
    )


def test_suffix_change_keeps_prefix_cached(
    send, recorder, expect_cache, primed, warm_corpus
):
    """Same system prompt, different user turn.

    This is the shape that actually matters in production: the assistant's
    fixed context is stable while the visitor's question changes every time.
    """
    varied = send(
        messages(warm_corpus, "Reply with a different single word: bravo."),
        label="suffix-read",
    )
    recorder.note_fields(varied.usage.discovered)

    expect_cache(
        "suffix_variation_hit",
        varied.usage.hit,
        f"changed only the user turn: {varied.usage.summary()}",
        usage=varied.usage.raw,
        hit_ratio=varied.usage.hit_ratio,
    )


def test_prefix_change_busts_cache(send, recorder, primed, warm_corpus, run_nonce):
    """One altered character at the very front should destroy the hit.

    Recorded rather than asserted: if the provider is smarter than documented
    (block-level rather than strict-prefix matching) that is worth knowing,
    not worth failing over.
    """
    mutated = f"X{run_nonce}\n" + warm_corpus
    busted = send(
        messages(mutated, "Reply with the single word: base."),
        label="bust-read",
    )
    recorder.note_fields(busted.usage.discovered)

    outcome = "not-cached" if not busted.usage.hit else "inconclusive"
    recorder.add(
        "prefix_change_busts",
        outcome,
        (
            "prepending a nonce "
            + ("removed the hit as expected" if not busted.usage.hit else "still hit")
            + f": {busted.usage.summary()}"
        ),
        usage=busted.usage.raw,
    )
