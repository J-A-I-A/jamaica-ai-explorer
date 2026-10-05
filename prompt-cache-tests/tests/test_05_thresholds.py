"""Boundaries: minimum size, and how long an entry survives.

Both are opt-in-ish. The size check is cheap. The retention probe idles for
minutes and only runs when you ask for it with --retention-wait.
"""

from __future__ import annotations

import time

import pytest

from cache_probe.prompts import messages, tiny_prefix, warm_prefix

pytestmark = pytest.mark.costs_tokens


def test_short_prompt_below_minimum(send, recorder, warmup_delay):
    """Prompts under ~1,024 tokens are normally ineligible.

    Recorded, not asserted — a provider that caches small prompts is a pleasant
    surprise, not a failure.
    """
    short = tiny_prefix()
    send(messages(short, "Say: small one."), label="short-write")
    time.sleep(warmup_delay)
    second = send(messages(short, "Say: small one."), label="short-read")
    recorder.note_fields(second.usage.discovered)

    recorder.add(
        "short_prompt_cached",
        "cached" if second.usage.hit else "not-cached",
        (
            f"{second.usage.prompt_tokens}-token prompt "
            + ("was cached" if second.usage.hit else "was not cached, as expected")
        ),
        usage=second.usage.raw,
    )


@pytest.mark.slow
def test_cache_survives_idle_period(
    send, recorder, pytestconfig, warmup_delay, chars_per_token
):
    """How long does an entry live? Run with --retention-wait=400 or similar.

    In-memory caches typically evict after 5–10 minutes of inactivity;
    extended-retention tiers hold for hours. This distinguishes them.
    """
    wait = int(pytestconfig.getoption("--retention-wait"))
    if wait <= 0:
        pytest.skip("retention probe disabled; pass --retention-wait=SECONDS to run it")

    corpus = warm_prefix(chars_per_token=chars_per_token)
    send(messages(corpus, "Say: retention."), label="retention-write")
    time.sleep(warmup_delay)

    immediate = send(messages(corpus, "Say: retention."), label="retention-immediate")
    recorder.note_fields(immediate.usage.discovered)

    time.sleep(wait)

    delayed = send(messages(corpus, "Say: retention."), label="retention-delayed")
    recorder.note_fields(delayed.usage.discovered)

    recorder.add(
        "cache_survives_idle",
        "cached" if delayed.usage.hit else "not-cached",
        (
            f"after {wait}s idle: {delayed.usage.summary()} "
            f"(immediately after write it was {immediate.usage.summary()})"
        ),
        wait_seconds=wait,
        immediate=immediate.usage.raw,
        delayed=delayed.usage.raw,
    )
