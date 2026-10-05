from __future__ import annotations

import os
import uuid
from dataclasses import replace
from pathlib import Path

import pytest

from cache_probe import (
    ContentFilteredError,
    ProbeClient,
    ProbeConfigError,
    Recorder,
    Settings,
)
from cache_probe.prompts import calibration_sample, messages, quantise_ratio

ROOT = Path(__file__).resolve().parent


def pytest_addoption(parser: pytest.Parser) -> None:
    parser.addoption(
        "--strict-cache",
        action="store_true",
        default=False,
        help="Turn cache-hit expectations into hard failures instead of findings.",
    )
    parser.addoption(
        "--retention-wait",
        type=int,
        default=0,
        help=(
            "Seconds to wait before the retention probe. 0 skips it. "
            "Try 400 (~7min) to see whether an in-memory cache has expired."
        ),
    )
    parser.addoption(
        "--warmup-delay",
        type=float,
        default=2.0,
        help="Seconds between the cache-writing call and the reading call.",
    )
    parser.addoption(
        "--tpm",
        type=int,
        default=None,
        help=(
            "Tokens-per-minute quota to stay under. Overrides TPM_LIMIT. "
            "0 disables pacing. Default 20000."
        ),
    )


def pytest_configure(config: pytest.Config) -> None:
    config.addinivalue_line("markers", "slow: makes the run take minutes, not seconds")
    config.addinivalue_line("markers", "costs_tokens: issues real billable requests")


def _load_dotenv() -> None:
    """Minimal .env loader so the suite has no config dependency."""
    path = ROOT / ".env"
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


@pytest.fixture(scope="session")
def settings(pytestconfig: pytest.Config) -> Settings:
    _load_dotenv()
    try:
        cfg = Settings.from_env()
    except ProbeConfigError as exc:
        pytest.skip(str(exc))
    override = pytestconfig.getoption("--tpm")
    if override is not None:
        cfg = replace(cfg, tpm_limit=override)
    return cfg


@pytest.fixture(scope="session")
def recorder(request: pytest.FixtureRequest, settings: Settings) -> Recorder:
    rec = Recorder(model=settings.model, base_url=settings.base_url)
    # Hand it to the session so pytest_sessionfinish can write the report.
    # Done here rather than in an autouse fixture so the offline unit tests
    # never touch configuration.
    request.session._cache_recorder = rec  # type: ignore[attr-defined]
    return rec


@pytest.fixture(scope="session")
def client(settings: Settings, recorder: Recorder):
    probe = ProbeClient(settings)
    yield probe
    recorder.total_prompt_tokens = probe.total_prompt_tokens
    recorder.total_completion_tokens = probe.total_completion_tokens
    recorder.tpm_limit = settings.tpm_limit
    recorder.pacing = probe.budget.summary()
    recorder.rate_limit_hits = probe.rate_limit_hits
    probe.close()


@pytest.fixture(scope="session")
def run_nonce() -> str:
    """Fresh per run, so 'cold' prompts are genuinely cold."""
    return uuid.uuid4().hex[:12]


@pytest.fixture(scope="session")
def chars_per_token(send, recorder) -> float:
    """Measure how many characters of our filler make one token here.

    Hardcoding this is how the corpora ended up at 815 tokens instead of 1,300 —
    under the caching floor, which makes every downstream result meaningless.
    Tokenisers differ by model, and repetitive prose compresses far better than
    the usual English estimate, so ask the endpoint rather than assume.

    One small call, and the answer is quantised so the corpus text stays
    byte-identical between runs against the same deployment.
    """
    sample = calibration_sample()
    call = send(
        messages(sample, "Reply with the single word: calibrated."),
        label="calibration",
    )
    tokens = call.usage.prompt_tokens
    if not tokens:
        recorder.add(
            "calibration",
            "inconclusive",
            "endpoint reported no prompt_tokens; falling back to the default ratio",
        )
        return quantise_ratio(0)  # out of range -> default

    measured = len(sample) / tokens
    ratio = quantise_ratio(measured)
    recorder.add(
        "calibration",
        "inconclusive",
        f"{len(sample)} chars billed as {tokens} tokens "
        f"({measured:.2f} chars/token, using {ratio:.2f})",
        chars=len(sample),
        prompt_tokens=tokens,
        measured=round(measured, 3),
        applied=ratio,
    )
    return ratio


@pytest.fixture(scope="session")
def strict(pytestconfig: pytest.Config) -> bool:
    return bool(pytestconfig.getoption("--strict-cache"))


@pytest.fixture(scope="session")
def warmup_delay(pytestconfig: pytest.Config) -> float:
    return float(pytestconfig.getoption("--warmup-delay"))


@pytest.fixture(scope="session")
def send(client, recorder):
    """Issue a call, converting a content-filter rejection into a skip.

    The filter says nothing about caching — it is a fact about the prompt text,
    or about how strictly the deployment is configured. Losing the whole run to
    it would throw away the checks that did work, so we record it as a finding
    and skip only what depended on that prompt.
    """
    return _make_sender(client, recorder)


def _make_sender(client, recorder):
    def _send(*args, **kwargs):
        try:
            return client.chat(*args, **kwargs)
        except ContentFilteredError as exc:
            recorder.add(
                "content_filter_blocked",
                "error",
                f"filter label '{exc.label}' rejected the prompt",
                filter_label=exc.label,
                filter_detail=exc.detail,
            )
            pytest.skip(
                f"content filter rejected this prompt (label: {exc.label}). "
                "Nothing can be measured about caching for it."
            )

    return _send


@pytest.fixture
def expect_cache(strict: bool, recorder: Recorder):
    """Record a cache expectation as a finding, or assert it under --strict-cache.

    This is the hinge of the whole suite: by default "no cache" is data, not a
    defect, so the run stays green and usable as a monitor.
    """

    def _expect(check: str, condition: bool, detail: str, **data) -> None:
        recorder.add(check, "cached" if condition else "not-cached", detail, **data)
        if strict and not condition:
            pytest.fail(f"{check}: {detail}")

    return _expect


def pytest_sessionfinish(session: pytest.Session, exitstatus: int) -> None:
    recorder: Recorder | None = getattr(session, "_cache_recorder", None)
    if recorder is None or not recorder.observations:
        return
    json_path, md_path = recorder.write()
    reporter = session.config.pluginmanager.get_plugin("terminalreporter")
    if reporter:
        reporter.write_sep("=", "PROMPT CACHE VERDICT")
        reporter.write_line(recorder.verdict)
        reporter.write_line(f"report: {md_path}")
        reporter.write_line(f"raw:    {json_path}")
