from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Role


class RoleRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def get_by_name(self, name: str) -> Role | None:
        return await self._session.scalar(select(Role).where(Role.name == name))

    async def list_all(self) -> list[Role]:
        return list((await self._session.scalars(select(Role).order_by(Role.id))).all())