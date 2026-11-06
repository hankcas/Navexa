import asyncio

from sqlalchemy import select

from app.core.config import settings
from app.core.security import hash_password
from app.db.models import Permission, Role, User
from app.db.session import SessionLocal, engine
from app.domain.permissions import DEFAULT_ROLE_PERMISSIONS, PermissionCode, RoleName

MIN_ADMIN_PASSWORD_LENGTH = 12


async def seed_permissions(session) -> dict[str, Permission]:
    existing = {p.code: p for p in (await session.scalars(select(Permission))).all()}
    for code in PermissionCode:
        if code.value not in existing:
            permission = Permission(code=code.value)
            session.add(permission)
            existing[code.value] = permission
    await session.flush()
    return existing


async def seed_roles(session, permissions: dict[str, Permission]) -> dict[str, Role]:
    existing = {r.name: r for r in (await session.scalars(select(Role))).all()}
    for role_name, codes in DEFAULT_ROLE_PERMISSIONS.items():
        role = existing.get(role_name.value)
        if role is None:
            role = Role(name=role_name.value)
            session.add(role)
            existing[role_name.value] = role
        role.permissions = [permissions[code.value] for code in sorted(codes)]
    await session.flush()
    return existing


async def seed_admin(session, roles: dict[str, Role]) -> None:
    email = settings.first_admin_email
    password = settings.first_admin_password
    if not email or not password:
        print("FIRST_ADMIN_EMAIL / FIRST_ADMIN_PASSWORD not set: admin not created.")
        return
    if len(password) < MIN_ADMIN_PASSWORD_LENGTH:
        raise SystemExit(
            f"FIRST_ADMIN_PASSWORD must have at least {MIN_ADMIN_PASSWORD_LENGTH} characters."
        )

    email = email.strip().lower()
    if await session.scalar(select(User).where(User.email == email)):
        print(f"Admin {email} already exists: skipped.")
        return

    session.add(
        User(
            email=email,
            full_name=settings.first_admin_name,
            password_hash=hash_password(password),
            role=roles[RoleName.ADMIN.value],
            must_change_password=False,
        )
    )
    print(f"Admin {email} created.")


async def main() -> None:
    async with SessionLocal() as session:
        permissions = await seed_permissions(session)
        roles = await seed_roles(session, permissions)
        await seed_admin(session, roles)
        await session.commit()
    await engine.dispose()
    print("Seed completed.")


if __name__ == "__main__":
    asyncio.run(main())