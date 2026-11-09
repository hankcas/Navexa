from fastapi import APIRouter, Depends, Request, Response, status

from app.api.dependencies import ACCESS_COOKIE, REFRESH_COOKIE, CurrentUserDep, DbSession
from app.core.config import settings
from app.core.csrf import CSRF_COOKIE, clear_csrf_cookie, set_csrf_cookie
from app.core.exceptions import AuthenticationError, RateLimitedError
from app.core.rate_limit import SlidingWindowRateLimiter
from app.core.security import ACCESS, REFRESH, create_token, decode_token
from app.db.models import User
from app.repositories.user_repository import UserRepository
from app.schemas.auth import ChangePasswordRequest, CurrentUser, LoginRequest
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])

REFRESH_COOKIE_PATH = "/api/v1/auth"


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


def _to_current_user(user: User) -> CurrentUser:
    return CurrentUser(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role.name,
        permissions=sorted(p.code for p in user.role.permissions),
        must_change_password=user.must_change_password,
    )


def _set_session_cookies(response: Response, user: User) -> None:
    common = {
        "httponly": True,
        "secure": settings.cookie_secure,
        "samesite": settings.cookie_samesite,
    }
    response.set_cookie(
        ACCESS_COOKIE,
        create_token(user.id, user.token_version, ACCESS),
        max_age=settings.access_token_minutes * 60,
        path="/",
        **common,
    )
    response.set_cookie(
        REFRESH_COOKIE,
        create_token(user.id, user.token_version, REFRESH),
        max_age=settings.refresh_token_days * 24 * 3600,
        path=REFRESH_COOKIE_PATH,
        **common,
    )


def _clear_session_cookies(response: Response) -> None:
    response.delete_cookie(ACCESS_COOKIE, path="/")
    response.delete_cookie(REFRESH_COOKIE, path=REFRESH_COOKIE_PATH)
    clear_csrf_cookie(response)


def _ensure_csrf_cookie(request: Request, response: Response) -> None:
    """Hands a CSRF token to sessions that do not have one yet (e.g. opened before it existed).

    It is not rotated here: a request already in flight with the current token would fail.
    """
    if CSRF_COOKIE not in request.cookies:
        set_csrf_cookie(response)


login_rate_limiter = SlidingWindowRateLimiter(
    settings.login_rate_limit_attempts, settings.login_rate_limit_window_seconds
)


def limit_login_attempts(request: Request) -> None:
    """Every login attempt counts, right or wrong, so guessing passwords from one IP is slow (SEG-07)."""
    retry_after = login_rate_limiter.hit(_client_ip(request) or "unknown")
    if retry_after is not None:
        raise RateLimitedError(retry_after)


@router.post("/login", response_model=CurrentUser, dependencies=[Depends(limit_login_attempts)])
async def login(
    body: LoginRequest, request: Request, response: Response, db: DbSession
) -> CurrentUser:
    user = await AuthService(db).authenticate(
        body.email, body.password, _client_ip(request)
    )
    _set_session_cookies(response, user)
    # A fresh token for every new session (SEG-11).
    set_csrf_cookie(response)
    return _to_current_user(user)


@router.post("/refresh", response_model=CurrentUser)
async def refresh(request: Request, response: Response, db: DbSession) -> CurrentUser:
    token = request.cookies.get(REFRESH_COOKIE)
    payload = decode_token(token, REFRESH) if token else None
    user = await UserRepository(db).get_by_id(int(payload["sub"])) if payload else None
    if user is None or not user.is_active or user.token_version != payload["ver"]:
        _clear_session_cookies(response)
        raise AuthenticationError("Invalid refresh token")
    _set_session_cookies(response, user)
    _ensure_csrf_cookie(request, response)
    return _to_current_user(user)


@router.post("/change-password", response_model=CurrentUser)
async def change_password(
    body: ChangePasswordRequest,
    user: CurrentUserDep,
    request: Request,
    response: Response,
    db: DbSession,
) -> CurrentUser:
    await AuthService(db).change_password(
        user, body.current_password, body.new_password, _client_ip(request)
    )
    _set_session_cookies(response, user)
    set_csrf_cookie(response)
    return _to_current_user(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    user: CurrentUserDep, request: Request, response: Response, db: DbSession
) -> None:
    await AuthService(db).logout(user, _client_ip(request))
    _clear_session_cookies(response)


@router.get("/me", response_model=CurrentUser)
async def me(user: CurrentUserDep, request: Request, response: Response) -> CurrentUser:
    _ensure_csrf_cookie(request, response)
    return _to_current_user(user)