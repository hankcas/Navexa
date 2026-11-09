from datetime import datetime

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import AuditLog
from app.schemas.audit import AuditCategory


class AuditRepository:
    """Reads the audit log. Filtering and paging happen in the database, so the table can grow
    without the server loading it whole."""

    def __init__(self, session: AsyncSession):
        self._session = session

    async def list_page(
        self,
        *,
        category: AuditCategory | None,
        search: str | None,
        start: datetime | None,
        end: datetime | None,
        offset: int,
        limit: int,
    ) -> tuple[list[AuditLog], int]:
        query = select(AuditLog)
        if category:
            # "drivers." and not "drivers": a prefix that cannot match another category.
            query = query.where(AuditLog.action.startswith(f"{category.value}."))
        if search:
            # Bound parameters: what the user types is never part of the SQL text.
            term = f"%{search.strip().lower()}%"
            query = query.where(
                or_(
                    func.lower(AuditLog.actor_email).like(term),
                    func.lower(AuditLog.entity_id).like(term),
                )
            )
        if start:
            query = query.where(AuditLog.created_at >= start)
        if end:
            query = query.where(AuditLog.created_at < end)

        total = await self._session.scalar(select(func.count()).select_from(query.subquery()))
        rows = await self._session.scalars(
            # Newest first; the id breaks ties between entries written in the same instant.
            query.order_by(AuditLog.created_at.desc(), AuditLog.id.desc()).offset(offset).limit(limit)
        )
        return list(rows.all()), total or 0
