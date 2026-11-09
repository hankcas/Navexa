"""SEG-11: state-changing requests need the CSRF token; reads and the login do not."""
import pytest
from fastapi.testclient import TestClient

from app.api.dependencies import get_current_user
from app.core.csrf import CSRF_COOKIE, CSRF_HEADER, new_csrf_token
from app.core.exceptions import AuthenticationError
from app.main import app
from tests.api.helpers import browser_client


@pytest.fixture(autouse=True)
def no_session():
    """Without a session every route answers 401 after the CSRF check, so a 401 proves the
    request got past CSRF, and a 403 proves CSRF stopped it."""

    def current_user():
        raise AuthenticationError("no session")

    app.dependency_overrides[get_current_user] = current_user
    yield
    app.dependency_overrides.clear()


@pytest.mark.parametrize("method", ["POST", "PATCH", "PUT", "DELETE"])
def test_a_write_without_the_token_is_refused_before_reaching_the_route(method):
    response = TestClient(app).request(method, "/api/v1/drivers/1-1", json={})

    assert response.status_code == 403
    assert response.headers["content-type"] == "application/problem+json"
    assert response.json()["title"] == "Solicitud no válida"


def test_a_header_that_does_not_match_the_cookie_is_refused():
    client = TestClient(app, headers={CSRF_HEADER: new_csrf_token()})
    client.cookies.set(CSRF_COOKIE, new_csrf_token())
    assert client.post("/api/v1/auth/logout").status_code == 403


def test_a_write_with_the_token_goes_through():
    assert browser_client().post("/api/v1/auth/logout").status_code == 401


def test_reads_do_not_need_the_token():
    assert TestClient(app).get("/api/v1/auth/me").status_code == 401


def test_the_login_does_not_need_the_token():
    # 422: the empty body reached the route validation, so CSRF did not block it.
    assert TestClient(app).post("/api/v1/auth/login", json={}).status_code == 422


def test_health_is_not_affected():
    assert TestClient(app).get("/health").status_code == 200
