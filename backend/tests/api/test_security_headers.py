"""SEG-05 and DEP-03: security headers on every response and no cross-origin access."""
from fastapi.testclient import TestClient

from app.main import app


def test_every_api_response_carries_the_security_headers():
    response = TestClient(app).get("/api/v1/auth/me")  # 401, errors must be covered too

    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["Referrer-Policy"] == "no-referrer"
    assert response.headers["Content-Security-Policy"] == "default-src 'none'; frame-ancestors 'none'"
    assert response.headers["Cache-Control"] == "no-store"


def test_responses_blocked_by_csrf_also_get_them():
    response = TestClient(app).post("/api/v1/auth/logout")
    assert response.status_code == 403
    assert response.headers["X-Content-Type-Options"] == "nosniff"


def test_the_docs_keep_working_without_the_api_csp():
    response = TestClient(app).get("/docs")
    assert response.status_code == 200
    assert "Content-Security-Policy" not in response.headers


def test_an_unknown_origin_gets_no_cors_permission():
    response = TestClient(app).options(
        "/api/v1/vehicles",
        headers={"Origin": "https://sitio-malicioso.com", "Access-Control-Request-Method": "GET"},
    )
    assert "access-control-allow-origin" not in response.headers
