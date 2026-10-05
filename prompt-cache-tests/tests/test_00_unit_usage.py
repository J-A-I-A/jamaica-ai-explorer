"""Offline tests for the detector itself. No network, no tokens, no config.

If these fail, the probe would misread a real endpoint, so they run first and
gate everything else.
"""

from __future__ import annotations

import re

import pytest

from cache_probe.prompts import (
    CACHE_FLOOR_TOKENS,
    CHARS_PER_TOKEN,
    calibration_sample,
    cold_prefix,
    deterministic_filler,
    quantise_ratio,
    warm_prefix,
)
from cache_probe.usage import parse_usage

OPENAI_STYLE = {
    "usage": {
        "prompt_tokens": 5000,
        "completion_tokens": 20,
        "total_tokens": 5020,
        "prompt_tokens_details": {"cached_tokens": 4864, "cache_write_tokens": 0},
    }
}

DEEPSEEK_STYLE = {
    "usage": {
        "prompt_tokens": 5000,
        "completion_tokens": 20,
        "prompt_cache_hit_tokens": 4800,
        "prompt_cache_miss_tokens": 200,
    }
}

ANTHROPIC_STYLE = {
    "usage": {
        "prompt_tokens": 5000,
        "cache_read_input_tokens": 4700,
        "cache_creation_input_tokens": 300,
    }
}

UNKNOWN_STYLE = {
    "usage": {
        "prompt_tokens": 5000,
        "kv_cache_reused_tokens": 4500,
    }
}

NO_CACHE = {"usage": {"prompt_tokens": 5000, "completion_tokens": 20}}


@pytest.mark.parametrize(
    "body,expected_read",
    [
        (OPENAI_STYLE, 4864),
        (DEEPSEEK_STYLE, 4800),
        (ANTHROPIC_STYLE, 4700),
        (UNKNOWN_STYLE, 4500),
    ],
)
def test_reads_every_known_convention(body, expected_read):
    usage = parse_usage(body)
    assert usage.cache_read == expected_read
    assert usage.hit is True


def test_unknown_field_is_still_discovered():
    usage = parse_usage(UNKNOWN_STYLE)
    assert "kv_cache_reused_tokens" in usage.discovered
    assert usage.cache_read_field == "kv_cache_reused_tokens"


def test_write_field_not_mistaken_for_read():
    usage = parse_usage(ANTHROPIC_STYLE)
    assert usage.cache_read == 4700
    assert usage.cache_write == 300


def test_absent_telemetry_is_not_a_hit():
    usage = parse_usage(NO_CACHE)
    assert usage.cache_read is None
    assert usage.hit is False
    assert usage.reports_any_cache_field is False


def test_miss_only_reporting_infers_a_hit():
    """Some providers report only misses; a partial miss implies reuse."""
    usage = parse_usage({"usage": {"prompt_tokens": 5000, "prompt_cache_miss_tokens": 200}})
    assert usage.hit is True
    usage_total_miss = parse_usage(
        {"usage": {"prompt_tokens": 5000, "prompt_cache_miss_tokens": 5000}}
    )
    assert usage_total_miss.hit is False


def test_hit_ratio():
    assert parse_usage(OPENAI_STYLE).hit_ratio == pytest.approx(4864 / 5000)
    assert parse_usage(NO_CACHE).hit_ratio is None


def test_filler_is_deterministic():
    assert deterministic_filler(300, seed="x") == deterministic_filler(300, seed="x")
    assert deterministic_filler(300, seed="x") != deterministic_filler(300, seed="y")


def test_filler_reads_as_prose_not_entropy():
    """Guards the fix for a real failure.

    The first version of the filler was a chain of SHA-256 hex digests. Azure's
    content filter classified it as a `Jailbreak` attempt and rejected the whole
    request with a 400, because a long run of high-entropy characters is what an
    obfuscated payload looks like. If someone reaches for hashes again for
    determinism, this test should stop them.
    """
    text = deterministic_filler(400, seed="entropy-check")

    # No long alphanumeric runs — the signature of hex, base64 or a token blob.
    longest = max((len(w) for w in re.findall(r"[A-Za-z0-9]+", text)), default=0)
    assert longest <= 16, f"found a {longest}-character run; that looks encoded, not written"

    # Vocabulary should repeat, as real prose does. Random hex barely repeats at
    # all, so a low unique-word ratio is evidence of actual language.
    words = [w.lower() for w in re.findall(r"[A-Za-z]+", text)]
    assert len(words) > 50
    assert len(set(words)) / len(words) < 0.5, "vocabulary too varied to be prose"

    # And it should contain recognisable English.
    assert " the " in text
    assert text.count(".") > 10


def test_filler_avoids_instruction_like_language():
    """Nothing in the corpus should read as an instruction to the model.

    Imperatives aimed at the assistant are the other reliable way to trip a
    jailbreak classifier.
    """
    lowered = deterministic_filler(400, seed="instruction-check").lower()
    for phrase in ("ignore", "disregard", "system prompt", "you are", "pretend"):
        assert phrase not in lowered, f"filler contains instruction-like text: {phrase!r}"


def test_warm_prefix_is_stable_and_cold_is_not():
    assert warm_prefix(target_tokens=200) == warm_prefix(target_tokens=200)
    assert cold_prefix("aaa", target_tokens=200) != cold_prefix("bbb", target_tokens=200)


def test_quantise_ratio_rounds_to_a_coarse_step():
    """Quantising is what keeps the warm corpus byte-identical between runs.

    A one-token difference in the calibration call would otherwise change the
    corpus text, and a corpus that changes between runs cannot test a cache that
    persists between runs.
    """
    assert quantise_ratio(5.54) == 5.5
    assert quantise_ratio(5.61) == 5.5
    assert quantise_ratio(5.63) == 5.75
    # Nearby measurements must land on the same value.
    assert quantise_ratio(5.50) == quantise_ratio(5.59)


def test_quantise_ratio_rejects_implausible_measurements():
    """An absurd ratio means the endpoint reported something unexpected."""
    assert quantise_ratio(0) == CHARS_PER_TOKEN
    assert quantise_ratio(0.4) == CHARS_PER_TOKEN
    assert quantise_ratio(50) == CHARS_PER_TOKEN


@pytest.mark.parametrize("ratio", [3.5, 4.5, 5.5, 6.5])
def test_filler_honours_the_measured_ratio(ratio):
    """Sizing must track the ratio, or corpora land under the caching floor.

    This is the regression guard for a real failure: with the ratio hardcoded at
    3.6 against an endpoint that actually billed 5.5, a corpus aimed at 1,300
    tokens arrived as 815 — below the floor, making the cache result meaningless.
    """
    target = 1300
    text = deterministic_filler(target, seed="ratio", chars_per_token=ratio)
    implied_tokens = len(text) / ratio
    assert implied_tokens == pytest.approx(target, rel=0.1)


def test_default_corpus_clears_the_floor_across_plausible_ratios():
    """Whatever the endpoint's tokeniser, the default target must clear 1,024."""
    for ratio in (3.0, 4.0, 5.0, 5.5, 6.0, 7.0):
        text = warm_prefix(chars_per_token=ratio)
        implied = len(text) / ratio
        assert implied > CACHE_FLOOR_TOKENS, (
            f"at {ratio} chars/token the default corpus implies only "
            f"{implied:.0f} tokens, under the {CACHE_FLOOR_TOKENS} floor"
        )


def test_warm_prefix_stable_for_a_given_ratio():
    assert warm_prefix(chars_per_token=5.5) == warm_prefix(chars_per_token=5.5)
    assert warm_prefix(chars_per_token=5.5) != warm_prefix(chars_per_token=4.0)


def test_calibration_sample_is_fixed():
    assert calibration_sample() == calibration_sample()
    assert len(calibration_sample()) > 500, "sample too short to swamp template overhead"


def test_cold_nonce_leads_the_prompt():
    """The nonce must be in the first line or the prefix would still be shared."""
    prompt = cold_prefix("deadbeef", target_tokens=200)
    first_line = prompt.split("\n", 1)[0]
    assert "deadbeef" in first_line, (
        "the nonce must lead; placing it later leaves a shared prefix and the "
        f"'cold' prompt would quietly hit the cache. Got: {first_line!r}"
    )
