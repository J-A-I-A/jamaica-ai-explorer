"""Keep the probe inside a tokens-per-minute quota.

Azure enforces TPM over a rolling window and answers 429 when you exceed it.
The suite spends roughly 35–40k tokens; against a 20,000 TPM deployment that
must be spread over at least two minutes or it will trip.

So before each call we reserve an estimate against a rolling 60-second ledger
and sleep if the reservation would breach the budget. After the call we replace
the estimate with the token count the endpoint actually reported, which keeps
the ledger honest even though our pre-flight estimate is only approximate.

The clock and sleep are injectable so the unit tests can exercise the logic
without actually waiting.
"""

from __future__ import annotations

import time
from collections import deque
from dataclasses import dataclass, field
from typing import Callable

WINDOW_SECONDS = 60.0

# Pre-flight estimates are rough. Reserving slightly more than we expect to
# spend keeps us under the limit when the estimate runs low; the reservation is
# reconciled to the true figure immediately afterwards.
SAFETY_MARGIN = 1.15


@dataclass
class Entry:
    at: float
    tokens: int


@dataclass
class TokenBudget:
    """Rolling-window TPM limiter.

    `limit` of 0 disables pacing entirely, for endpoints with no quota (the
    mock server, a local model) where waiting would only slow the suite down.
    """

    limit: int
    # Azure's TPM window is 60s. Configurable because not every provider uses
    # the same period — and because it lets the test suite compress time.
    window: float = WINDOW_SECONDS
    now: Callable[[], float] = time.monotonic
    sleep: Callable[[float], None] = time.sleep
    _entries: deque[Entry] = field(default_factory=deque, repr=False)
    total_waited: float = 0.0
    waits: int = 0
    peak_window: int = 0

    @property
    def enabled(self) -> bool:
        return self.limit > 0

    def _evict(self) -> None:
        cutoff = self.now() - self.window
        while self._entries and self._entries[0].at <= cutoff:
            self._entries.popleft()

    @property
    def spent_in_window(self) -> int:
        self._evict()
        return sum(e.tokens for e in self._entries)

    def _seconds_until_room_for(self, tokens: int) -> float:
        """How long until `tokens` would fit under the limit."""
        self._evict()
        spent = sum(e.tokens for e in self._entries)
        if spent + tokens <= self.limit:
            return 0.0
        # Age out the oldest entries until the request fits, and wait for the
        # last one we needed to expire.
        freed = 0
        now = self.now()
        for entry in self._entries:
            freed += entry.tokens
            if spent - freed + tokens <= self.limit:
                # +0.05 so we wake just after it leaves the window, not on the
                # boundary where a race could still count it.
                return max(0.0, (entry.at + self.window) - now + 0.05)
        # A single request larger than the whole budget can never fit. Drain the
        # window completely and let it through; the endpoint will decide.
        if self._entries:
            oldest_possible = self._entries[-1].at + self.window
            return max(0.0, oldest_possible - now + 0.05)
        return 0.0

    def reserve(self, estimated_tokens: int) -> float:
        """Block until `estimated_tokens` fit in the window. Returns seconds slept."""
        if not self.enabled:
            return 0.0
        padded = int(estimated_tokens * SAFETY_MARGIN)
        wait = self._seconds_until_room_for(padded)
        if wait > 0:
            self.sleep(wait)
            self.total_waited += wait
            self.waits += 1
        self._entries.append(Entry(at=self.now(), tokens=padded))
        return wait

    def reconcile(self, actual_tokens: int) -> None:
        """Replace the last reservation with the figure the endpoint reported."""
        if not self.enabled or not self._entries:
            return
        self._entries[-1].tokens = actual_tokens
        self.peak_window = max(self.peak_window, self.spent_in_window)

    def charge(self, tokens: int) -> None:
        """Record tokens spent outside a reservation — e.g. a failed attempt
        that the provider still counted against quota."""
        if not self.enabled:
            return
        self._entries.append(Entry(at=self.now(), tokens=tokens))

    def summary(self) -> str:
        if not self.enabled:
            return "pacing disabled"
        return (
            f"{self.limit:,} TPM budget; paused {self.waits} time(s) "
            f"for {self.total_waited:.0f}s total; peak window {self.peak_window:,} tokens"
        )
