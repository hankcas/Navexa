from fastapi.testclient import TestClient

from app.core.csrf import CSRF_COOKIE, CSRF_HEADER, new_csrf_token
from app.main import app


def browser_client() -> TestClient:
    """A test client that behaves like our frontend: it has the CSRF cookie and sends the
    same value in the header on every request (SEG-11).

    Not used as a context manager, so the app lifespan (real Wialon client) does not start.
    """
    token = new_csrf_token()
    client = TestClient(app, headers={CSRF_HEADER: token})
    client.cookies.set(CSRF_COOKIE, token)
    return client
