"""Which cache telemetry, if any, does this endpoint speak?

Providers disagree on field names, so we look for every known convention plus
anything cache-shaped we have not seen before. A negative result here does not
prove caching is off — a provider can cache silently and bill you for it
without saying so — but a positive result tells us exactly which number the
later tests should be watching.

One request serves both checks in this module. On a 20,000 TPM deployment a
redundant 1,200-token call is not free: it is roughly four seconds of pacing
delay for the rest of the run.
"""

from __future__ import annotations

import pytest

from cache_probe.prompts import CACHE_FLOOR_TOKENS, cold_prefix, messages

pytestmark = pytest.mark.costs_tokens


@pytest.fixture(scope="module")
def cold_call(send, recorder, run_nonce, chars_per_token):
    """A single never-before-sent prompt, shared by both checks below."""
    call = send(
        messages(
            cold_prefix(f"{run_nonce}-cold", chars_per_token=chars_per_token),
            "Reply with the single word: cold.",
        ),
        label="cold-baseline",
    )
    recorder.note_fields(call.usage.discovered)
    return call


def test_discover_cache_fields(cold_call, recorder):
    usage = cold_call.usage

    if usage.discovered:
        recorder.add(
            "cache_fields_present",
            "cached",
            "endpoint reports: " + ", ".join(sorted(usage.discovered)),
            fields=usage.discovered,
        )
    else:
        recorder.add(
            "cache_fields_present",
            "not-cached",
            "no cache-related key found anywhere in usage",
            raw_usage=usage.raw,
        )

    assert usage.prompt_tokens and usage.prompt_tokens > CACHE_FLOOR_TOKENS, (
        f"the probe corpus billed as {usage.prompt_tokens} tokens, below the "
        f"~{CACHE_FLOOR_TOKENS}-token floor providers require before they cache "
        "anything — so a cache miss below would prove nothing.\n"
        "The corpus is sized from a chars-per-token ratio measured against this "
        "endpoint at the start of the run; see the 'calibration' row in the "
        "report for what it measured. If that ratio looks wrong, raise "
        "DEFAULT_CORPUS_TOKENS in cache_probe/prompts.py."
    )


def test_cold_prompt_is_not_already_cached(cold_call, recorder):
    """A never-before-sent prefix must be a miss, or our signal is noise.

    If a prompt containing a fresh UUID comes back as cached, the endpoint is
    reporting something other than genuine prefix reuse and every later
    assertion is untrustworthy.
    """
    usage = cold_call.usage
    recorder.add(
        "cold_baseline_is_miss",
        "cached" if not usage.hit else "error",
        f"unseen prefix reported {usage.summary()}",
        hit=usage.hit,
        cache_read=usage.cache_read,
    )
    assert not usage.hit, (
        "a prompt containing a fresh nonce was reported as cached "
        f"({usage.summary()}). The telemetry does not mean what we think it "
        "means; treat later results as unreliable."
    )
