import math
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BusinessRuleError
from app.core.security import generate_temporary_password, hash_password
from app.db.models import User
from app.repositories.role_repository import RoleRepository
from app.repositories.user_repository import UserRepository
from app.schemas.pagination import Page
from app.schemas.user import UserCreate, UserOut, UserUpdate, UserWithTemporaryPassword
from app.services.audit_service import AuditService


def to_user_out(user: User) -> UserOut:
    locked_until = user.locked_until
    if locked_until and locked_until.tzinfo is None:
        locked_until = locked_until.replace(tzinfo=timezone.utc)
    return UserOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role.name,
        is_active=user.is_active,
        must_change_password=user.must_change_password,
        is_locked=bool(locked_until and locked_until > datetime.now(timezone.utc)),
        created_at=user.created_at,
    )


class UserService:
    def __init__(self, session: AsyncSession):
        self._session = session
        self._users = UserRepository(session)
        self._roles = RoleRepository(session)
        self._audit = AuditService(session)

    async def list_users(
        self, *, search: str | None, page: int, page_size: int
    ) -> Page[UserOut]:
        users, total = await self._users.list_page(
            search=search, offset=(page - 1) * page_size, limit=page_size
        )
        return Page[UserOut](
            items=[to_user_out(u) for u in users],
            total=total,
            page=page,
            page_size=page_size,
            pages=math.ceil(total / page_size) if total else 0,
        )

    async def create_user(
        self, actor: User, data: UserCreate, ip: str | None
    ) -> UserWithTemporaryPassword:
        email = data.email.strip().lower()
        if await self._users.get_by_email(email):
            raise BusinessRuleError(
                "Ya existe un usuario con ese correo.",
                status_code=409,
                title="Conflicto",
            )
        role = await self._roles.get_by_name(data.role.value)
        temporary_password = generate_temporary_password()
        user = User(
            email=email,
            full_name=data.full_name.strip(),
            password_hash=hash_password(temporary_password),
            role=role,
            must_change_password=True,
        )
        self._users.add(user)
        await self._session.flush()
        self._audit.record(
            "users.created",
            actor=actor,
            entity_type="user",
            entity_id=str(user.id),
            details={"email": email, "role": data.role.value},
            ip_address=ip,
        )
        await self._session.commit()
        await self._session.refresh(user)
        return UserWithTemporaryPassword(
            user=to_user_out(user), temporary_password=temporary_password
        )

    async def update_user(
        self, actor: User, user_id: int, data: UserUpdate, ip: str | None
    ) -> UserOut:
        user = await self._get_or_404(user_id)
        changes: dict[str, object] = {}

        if user.id == actor.id and (
            (data.role is not None and data.role.value != user.role.name)
            or data.is_active is False
        ):
            raise BusinessRuleError(
                "No puedes cambiar tu propio rol ni desactivar tu propia cuenta."
            )

        if data.full_name is not None and data.full_name.strip() != user.full_name:
            user.full_name = data.full_name.strip()
            changes["full_name"] = user.full_name

        if data.role is not None and data.role.value != user.role.name:
            changes["role"] = {"from": user.role.name, "to": data.role.value}
            user.role = await self._roles.get_by_name(data.role.value)
            user.token_version += 1

        if data.is_active is not None and data.is_active != user.is_active:
            user.is_active = data.is_active
            changes["is_active"] = data.is_active
            user.token_version += 1

        if changes:
            self._audit.record(
                "users.updated",
                actor=actor,
                entity_type="user",
                entity_id=str(user.id),
                details=changes,
                ip_address=ip,
            )
            await self._session.commit()
            await self._session.refresh(user)
        return to_user_out(user)

    async def reset_password(
        self, actor: User, user_id: int, ip: str | None
    ) -> UserWithTemporaryPassword:
        user = await self._get_or_404(user_id)
        temporary_password = generate_temporary_password()
        user.password_hash = hash_password(temporary_password)
        user.must_change_password = True
        user.failed_login_attempts = 0
        user.locked_until = None
        user.token_version += 1
        self._audit.record(
            "users.password_reset",
            actor=actor,
            entity_type="user",
            entity_id=str(user.id),
            ip_address=ip,
        )
        await self._session.commit()
        await self._session.refresh(user)
        return UserWithTemporaryPassword(
            user=to_user_out(user), temporary_password=temporary_password
        )

    async def _get_or_404(self, user_id: int) -> User:
        user = await self._users.get_by_id(user_id)
        if user is None:
            raise BusinessRuleError(
                "El usuario no existe.", status_code=404, title="No encontrado"
            )
        return user