from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AuthenticationError, BusinessRuleError
from app.core.security import hash_password, verify_password
from app.db.models import User
from app.repositories.user_repository import UserRepository
from app.services.audit_service import AuditService

MAX_FAILED_ATTEMPTS = 5
LOCK_DURATION = timedelta(minutes=15)

# Used to spend the same time verifying a password when the email does not exist,
# so response times do not reveal which emails are registered.
_DUMMY_HASH = hash_password("dummy-password-for-timing")


def _as_utc(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


class AuthService:
    def __init__(self, session: AsyncSession):
        self._session = session
        self._users = UserRepository(session)
        self._audit = AuditService(session)

    async def authenticate(self, email: str, password: str, ip: str | None) -> User:
        user = await self._users.get_by_email(email)
        now = datetime.now(timezone.utc)

        if user is None:
            verify_password(password, _DUMMY_HASH)
            await self._fail(email, ip, reason="unknown_email")

        if not user.is_active:
            await self._fail(email, ip, reason="inactive", user=user)

        if user.locked_until and _as_utc(user.locked_until) > now:
            await self._fail(email, ip, reason="locked", user=user)

        if not verify_password(password, user.password_hash):
            user.failed_login_attempts += 1
            if user.failed_login_attempts >= MAX_FAILED_ATTEMPTS:
                user.locked_until = now + LOCK_DURATION
                user.failed_login_attempts = 0
            await self._fail(email, ip, reason="wrong_password", user=user)

        user.failed_login_attempts = 0
        user.locked_until = None
        self._audit.record("auth.login_success", actor=user, ip_address=ip)
        await self._session.commit()
        return user

    async def change_password(
        self, user: User, current_password: str, new_password: str, ip: str | None
    ) -> None:
        if not verify_password(current_password, user.password_hash):
            raise BusinessRuleError("La contraseña actual no es correcta.")
        if verify_password(new_password, user.password_hash):
            raise BusinessRuleError("La nueva contraseña debe ser diferente a la actual.")

        user.password_hash = hash_password(new_password)
        user.must_change_password = False
        user.token_version += 1
        self._audit.record("auth.password_changed", actor=user, ip_address=ip)
        await self._session.commit()

    async def logout(self, user: User, ip: str | None) -> None:
        user.token_version += 1
        self._audit.record("auth.logout", actor=user, ip_address=ip)
        await self._session.commit()

    async def _fail(
        self, email: str, ip: str | None, *, reason: str, user: User | None = None
    ) -> None:
        self._audit.record(
            "auth.login_failed",
            actor=user,
            actor_email=email.strip().lower()[:255],
            details={"reason": reason},
            ip_address=ip,
        )
        await self._session.commit()
        raise AuthenticationError("Invalid credentials")