"""Does the endpoint work at all, and does it account for tokens?

Everything downstream reads `usage`. If usage is absent or malformed, later
results would be silently meaningless rather than merely negative.
"""

from __future__ import annotations

import pytest

from cache_probe.prompts import messages, tiny_prefix

pytestmark = pytest.mark.costs_tokens


def test_endpoint_answers(send, recorder):
    call = send(
        messages(tiny_prefix(), "Reply with the single word: ready."),
        label="connectivity",
    )
    assert call.status == 200
    assert call.body.get("choices"), "response contained no choices"
    recorder.add(
        "connectivity",
        "inconclusive",
        f"endpoint responded in {call.latency_ms:.0f}ms",
        latency_ms=round(call.latency_ms),
        model_echo=call.body.get("model"),
    )


def test_usage_is_reported(send, recorder):
    call = send(
        messages(tiny_prefix(), "Reply with the single word: usage."),
        label="usage-shape",
    )
    usage = call.usage
    assert usage.prompt_tokens, (
        "endpoint returned no prompt_tokens; cache measurement is impossible "
        f"against this deployment. Raw usage: {usage.raw}"
    )
    recorder.note_fields(usage.discovered)
    recorder.add(
        "usage_reported",
        "inconclusive",
        f"usage keys: {sorted(usage.raw.keys())}",
        raw_usage=usage.raw,
    )
