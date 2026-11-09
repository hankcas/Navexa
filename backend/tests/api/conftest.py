import pytest

from app.api.v1.auth import login_rate_limiter
from app.main import app


@pytest.fixture(autouse=True)
def isolated_app_state():
    """Every API test starts with no login attempts counted and no dependency overrides,
    whatever ran before it."""
    login_rate_limiter.reset()
    yield
    login_rate_limiter.reset()
    app.dependency_overrides.clear()
