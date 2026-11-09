"""CSRF protection with signed double-submit tokens (SEG-11).

The session lives in cookies, which the browser also sends on requests started by other
sites. To prove a request comes from our own frontend:

1. After login the backend sets `csrf_token`, a cookie JavaScript CAN read, holding a random
   value signed with the server secret.
2. The frontend copies it into the `X-CSRF-Token` header of every state-changing request.
3. This middleware rejects those requests unless header and cookie match and the signature is
   valid. Another site can make the browser send the cookie, but cannot read it to copy it.
"""
import hashlib
import hmac
import logging
import secrets

from fastapi import Response
from starlette.requests import Request
from starlette.types import ASGIApp, Receive, Scope, Send

from app.core.config import settings
from app.core.errors import problem

logger = logging.getLogger(__name__)

CSRF_COOKIE = "csrf_token"
CSRF_HEADER = "X-CSRF-Token"
SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}
# No session exists yet when logging in, so there is nothing to forge a request with.
EXEMPT_PATHS = {"/api/v1/auth/login"}


def _sign(nonce: str) -> str:
    return hmac.new(
        settings.jwt_secret.encode(), f"csrf:{nonce}".encode(), hashlib.sha256
    ).hexdigest()


def new_csrf_token() -> str:
    nonce = secrets.token_urlsafe(32)
    return f"{nonce}.{_sign(nonce)}"


def is_valid_csrf(cookie_value: str | None, header_value: str | None) -> bool:
    if not cookie_value or not header_value:
        return False
    # compare_digest takes the same time whatever the input, so timing reveals nothing.
    if not hmac.compare_digest(cookie_value, header_value):
        return False
    nonce, _, signature = cookie_value.partition(".")
    return bool(nonce and signature) and hmac.compare_digest(signature, _sign(nonce))


def set_csrf_cookie(response: Response) -> None:
    response.set_cookie(
        CSRF_COOKIE,
        new_csrf_token(),
        max_age=settings.refresh_token_days * 24 * 3600,
        path="/",
        httponly=False,  # on purpose: the frontend must read it
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
    )


def clear_csrf_cookie(response: Response) -> None:
    response.delete_cookie(CSRF_COOKIE, path="/")


class CSRFMiddleware:
    """Checks every state-changing request to the API before any route runs (deny by default)."""

    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http" and self._needs_check(scope):
            request = Request(scope)
            if not is_valid_csrf(request.cookies.get(CSRF_COOKIE), request.headers.get(CSRF_HEADER)):
                logger.warning("CSRF check failed on %s %s", scope["method"], scope["path"])
                response = problem(
                    request,
                    403,
                    "Solicitud no válida",
                    "No pudimos verificar el origen de la solicitud. Recarga la página e inténtalo de nuevo.",
                )
                await response(scope, receive, send)
                return
        await self.app(scope, receive, send)

    @staticmethod
    def _needs_check(scope: Scope) -> bool:
        path: str = scope["path"]
        return (
            scope["method"] not in SAFE_METHODS
            and path.startswith("/api/")
            and path not in EXEMPT_PATHS
        )
