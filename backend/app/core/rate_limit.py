import time
from collections import deque
from collections.abc import Callable


class SlidingWindowRateLimiter:
    """Allows at most `max_attempts` per key inside a moving time window.

    Used to slow down password guessing from one IP (SEG-07), on top of the per-account lock.
    It lives in memory: enough for the single Render instance; several instances would need a
    shared store such as Redis (documented as a known limitation).
    """

    def __init__(
        self,
        max_attempts: int,
        window_seconds: float,
        clock: Callable[[], float] = time.monotonic,
    ):
        self._max_attempts = max_attempts
        self._window = window_seconds
        self._clock = clock
        self._attempts: dict[str, deque[float]] = {}

    def hit(self, key: str) -> float | None:
        """Records one attempt. Returns None if allowed, or the seconds to wait if not."""
        now = self._clock()
        attempts = self._attempts.setdefault(key, deque())
        while attempts and now - attempts[0] >= self._window:
            attempts.popleft()

        if len(attempts) >= self._max_attempts:
            return self._window - (now - attempts[0])

        attempts.append(now)
        self._forget_idle_keys(now)
        return None

    def reset(self) -> None:
        self._attempts.clear()

    def _forget_idle_keys(self, now: float) -> None:
        """Drops IPs with no recent attempts, so memory does not grow forever."""
        if len(self._attempts) < 1_000:
            return
        idle = [key for key, attempts in self._attempts.items() if not attempts or now - attempts[-1] >= self._window]
        for key in idle:
            del self._attempts[key]
