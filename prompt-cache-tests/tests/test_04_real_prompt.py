"""The production case: the policy explorer's actual system prompt.

fixtures/system_prompt.txt is a verbatim export of ASSISTANT_SYSTEM_PROMPT.
Synthetic filler proves the mechanism exists; this proves it applies to the
~4,900 tokens the site actually pays for on every turn.

This module is the expensive one — each call carries the full system prompt —
so it makes exactly three, sharing a single priming write. Under a 20,000 TPM
quota these three calls alone are ~15,000 tokens, most of one minute's budget.
"""

from __future__ import annotations

import time

import pytest

from cache_probe.prompts import (
    CACHE_FLOOR_TOKENS,
    load_real_system_prompt,
    messages,
)

pytestmark = pytest.mark.costs_tokens


@pytest.fixture(scope="module")
def system_prompt() -> str:
    try:
        return load_real_system_prompt()
    except FileNotFoundError as exc:
        pytest.skip(str(exc))


@pytest.fixture(scope="module")
def primed_real(send, recorder, system_prompt, warmup_delay):
    """First turn of a conversation: establishes the cache entry and gives us
    the true billed size of the shipped prompt."""
    call = send(
        messages(system_prompt, "What are the nine policy pillars?"),
        label="real-turn-1",
        max_output_tokens=32,
    )
    recorder.note_fields(call.usage.discovered)
    time.sleep(warmup_delay)
    return call


def test_real_prompt_size(primed_real, recorder):
    call = primed_real
    recorder.add(
        "real_prompt_size",
        "inconclusive",
        f"the shipped system prompt bills as {call.usage.prompt_tokens} prompt tokens",
        prompt_tokens=call.usage.prompt_tokens,
    )
    assert call.usage.prompt_tokens and call.usage.prompt_tokens > CACHE_FLOOR_TOKENS, (
        f"the shipped system prompt measured {call.usage.prompt_tokens} tokens, "
        f"below the ~{CACHE_FLOOR_TOKENS}-token floor most providers require to "
        "cache at all. If that is genuinely its size, prompt caching cannot help "
        "this workload and the quota request should be re-derived without it."
    )


def test_real_prompt_is_cacheable(
    send, recorder, expect_cache, primed_real, system_prompt
):
    """Second turn of the same conversation, as a visitor would ask it."""
    second = send(
        messages(system_prompt, "Which of them mention broadband?"),
        label="real-turn-2",
        max_output_tokens=32,
    )
    recorder.note_fields(second.usage.discovered)

    ratio = second.usage.hit_ratio
    expect_cache(
        "real_prompt_cached",
        second.usage.hit,
        (
            f"second turn: {second.usage.summary()}"
            + (f" ({ratio:.0%} of the prompt reused)" if ratio is not None else "")
        ),
        usage=second.usage.raw,
        hit_ratio=ratio,
    )


def test_conversation_growth_keeps_hitting(
    send, recorder, expect_cache, primed_real, system_prompt
):
    """Append-only history should extend the cached prefix, not invalidate it.

    This thread shares its opening system message and first question with the
    priming call, so the shared head should still be reused even though the
    conversation has grown around it.
    """
    thread = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": "What are the nine policy pillars?"},
        {"role": "assistant", "content": "They cover innovation, education, awareness, and more."},
        {"role": "user", "content": "Summarise the short-term actions."},
        {"role": "assistant", "content": "Short-term actions run one to three years."},
        {"role": "user", "content": "And the long-term ones?"},
    ]
    grown = send(thread, label="growth-read", max_output_tokens=32)
    recorder.note_fields(grown.usage.discovered)

    expect_cache(
        "append_only_growth_hit",
        grown.usage.hit,
        f"extended thread: {grown.usage.summary()}",
        usage=grown.usage.raw,
        hit_ratio=grown.usage.hit_ratio,
    )
