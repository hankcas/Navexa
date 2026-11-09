"""SEG-07: one IP cannot keep trying passwords; it gets 429 with Retry-After."""
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app


def test_the_attempt_after_the_limit_is_429_with_retry_after():
    client = TestClient(app)
    # An empty body is rejected by validation (422) without touching the database,
    # but it still counts as an attempt: the limit runs before anything else.
    for _ in range(settings.login_rate_limit_attempts):
        assert client.post("/api/v1/auth/login", json={}).status_code == 422

    response = client.post("/api/v1/auth/login", json={})

    assert response.status_code == 429
    assert response.headers["content-type"] == "application/problem+json"
    assert response.json()["title"] == "Demasiados intentos"
    assert 0 < int(response.headers["Retry-After"]) <= settings.login_rate_limit_window_seconds
