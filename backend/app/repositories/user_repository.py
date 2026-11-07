from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import User


class UserRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def get_by_id(self, user_id: int) -> User | None:
        return await self._session.get(User, user_id)

    async def get_by_email(self, email: str) -> User | None:
        return await self._session.scalar(
            select(User).where(User.email == email.strip().lower())
        )

    async def list_page(
        self, *, search: str | None, offset: int, limit: int
    ) -> tuple[list[User], int]:
        query = select(User)
        if search:
            term = f"%{search.strip().lower()}%"
            query = query.where(
                or_(func.lower(User.email).like(term), func.lower(User.full_name).like(term))
            )
        total = await self._session.scalar(
            select(func.count()).select_from(query.subquery())
        )
        rows = await self._session.scalars(
            query.order_by(User.id).offset(offset).limit(limit)
        )
        return list(rows.all()), total or 0

    def add(self, user: User) -> None:
        self._session.add(user)