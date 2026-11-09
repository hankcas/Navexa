from app.core.rate_limit import SlidingWindowRateLimiter


class FakeClock:
    def __init__(self):
        self.now = 1_000.0

    def __call__(self) -> float:
        return self.now


def test_allows_up_to_the_limit_then_says_how_long_to_wait():
    clock = FakeClock()
    limiter = SlidingWindowRateLimiter(3, 60, clock=clock)

    assert [limiter.hit("1.2.3.4") for _ in range(3)] == [None, None, None]
    clock.now += 10
    assert limiter.hit("1.2.3.4") == 50


def test_attempts_expire_as_the_window_moves():
    clock = FakeClock()
    limiter = SlidingWindowRateLimiter(2, 60, clock=clock)
    limiter.hit("ip")
    clock.now += 30
    limiter.hit("ip")

    clock.now += 31  # the first attempt is now older than 60 s
    assert limiter.hit("ip") is None
    assert limiter.hit("ip") is not None


def test_each_ip_has_its_own_count():
    limiter = SlidingWindowRateLimiter(1, 60, clock=FakeClock())
    assert limiter.hit("a") is None
    assert limiter.hit("b") is None
    assert limiter.hit("a") is not None


def test_a_refused_attempt_does_not_extend_the_wait():
    clock = FakeClock()
    limiter = SlidingWindowRateLimiter(1, 60, clock=clock)
    limiter.hit("ip")
    for _ in range(5):
        limiter.hit("ip")
    clock.now += 60
    assert limiter.hit("ip") is None
