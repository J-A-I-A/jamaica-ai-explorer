"""Offline tests for the TPM pacer, on a fake clock so nothing actually sleeps.

If the pacer is wrong the suite either trips 429s (too loose) or takes far
longer than it needs to (too tight), so it gets the same scrutiny as the
detector.
"""

from __future__ import annotations

import pytest

from cache_probe.pacing import SAFETY_MARGIN, WINDOW_SECONDS, TokenBudget


class FakeClock:
    """A clock that only moves when something sleeps."""

    def __init__(self) -> None:
        self.t = 1000.0
        self.slept: list[float] = []

    def now(self) -> float:
        return self.t

    def sleep(self, seconds: float) -> None:
        self.slept.append(seconds)
        self.t += seconds

    def advance(self, seconds: float) -> None:
        self.t += seconds


@pytest.fixture
def clock() -> FakeClock:
    return FakeClock()


def budget(clock: FakeClock, limit: int = 20_000) -> TokenBudget:
    return TokenBudget(limit=limit, now=clock.now, sleep=clock.sleep)


def test_under_budget_never_waits(clock):
    b = budget(clock)
    for _ in range(3):
        assert b.reserve(1_000) == 0.0
    assert clock.slept == []


def test_waits_when_window_would_overflow(clock):
    b = budget(clock, limit=10_000)
    b.reserve(5_000)
    b.reconcile(5_000)
    b.reserve(4_000)
    b.reconcile(4_000)
    # 9,000 spent; a further 5,000 does not fit and must wait for the first
    # entry to age out of the 60s window.
    waited = b.reserve(5_000)
    assert waited > 0
    assert clock.slept, "expected the pacer to sleep"
    assert waited <= WINDOW_SECONDS + 1


def test_window_slides_so_old_spend_stops_counting(clock):
    b = budget(clock, limit=10_000)
    b.reserve(9_000)
    b.reconcile(9_000)
    clock.advance(WINDOW_SECONDS + 1)
    # The earlier spend has aged out; this must go straight through.
    assert b.reserve(9_000) == 0.0


def test_reconcile_replaces_the_estimate(clock):
    b = budget(clock, limit=20_000)
    b.reserve(1_000)
    # The reservation is padded by the safety margin…
    assert b.spent_in_window == pytest.approx(int(1_000 * SAFETY_MARGIN))
    # …and replaced by the truth once the endpoint reports it.
    b.reconcile(1_312)
    assert b.spent_in_window == 1_312


def test_zero_limit_disables_pacing(clock):
    b = TokenBudget(limit=0, now=clock.now, sleep=clock.sleep)
    assert not b.enabled
    for _ in range(50):
        assert b.reserve(100_000) == 0.0
    assert clock.slept == []
    assert "disabled" in b.summary()


def test_request_larger_than_whole_budget_still_proceeds(clock):
    """A single call bigger than the limit can never fit; drain and let it go.

    Blocking forever would be worse than letting the endpoint answer — and the
    endpoint's 429, if it comes, is handled separately.
    """
    b = budget(clock, limit=5_000)
    b.reserve(4_000)
    b.reconcile(4_000)
    waited = b.reserve(20_000)
    assert waited <= WINDOW_SECONDS + 1


def test_charge_records_spend_outside_a_reservation(clock):
    b = budget(clock, limit=10_000)
    b.charge(3_000)
    assert b.spent_in_window == 3_000


def test_peak_window_is_tracked(clock):
    b = budget(clock, limit=50_000)
    b.reserve(5_000)
    b.reconcile(5_000)
    b.reserve(6_000)
    b.reconcile(6_000)
    assert b.peak_window == 11_000
    assert "peak window" in b.summary()


def test_realistic_suite_stays_under_20k(clock):
    """Replay the suite's actual call sizes and assert the window never breaches.

    These are the per-call totals the suite issues after trimming: two tiny
    connectivity calls, one cold corpus, four warm corpora, three full system
    prompts, two tiny threshold calls.
    """
    calls = [40, 40, 1_250, 1_250, 1_250, 1_250, 1_250, 4_950, 4_950, 5_100, 40, 40]
    b = budget(clock, limit=20_000)
    breaches: list[int] = []
    for tokens in calls:
        b.reserve(tokens)
        b.reconcile(tokens)
        if b.spent_in_window > 20_000:
            breaches.append(b.spent_in_window)
    assert not breaches, f"window exceeded 20,000 TPM: {breaches}"
    assert b.peak_window <= 20_000
