import math
from datetime import datetime, timezone

from app.core.exceptions import BusinessRuleError
from app.repositories.audit_repository import AuditRepository
from app.schemas.audit import AuditCategory, AuditEntry
from app.schemas.pagination import Page


def _utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


class AuditQueryService:
    """Lets an administrator read who did what and when (RF-26).

    Kept apart from AuditService, which writes entries: every module writes, only this screen
    reads, and the reading needs filters and pages that writing does not (single responsibility).
    """

    def __init__(self, entries: AuditRepository):
        self._entries = entries

    async def list_entries(
        self,
        *,
        category: AuditCategory | None = None,
        search: str | None = None,
        start: datetime | None = None,
        end: datetime | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Page[AuditEntry]:
        start, end = _utc(start), _utc(end)
        if start and end and end <= start:
            raise BusinessRuleError("La fecha final debe ser posterior a la inicial.")

        rows, total = await self._entries.list_page(
            category=category,
            search=search.strip() if search and search.strip() else None,
            start=start,
            end=end,
            offset=(page - 1) * page_size,
            limit=page_size,
        )
        return Page[AuditEntry](
            items=[AuditEntry.model_validate(row, from_attributes=True) for row in rows],
            total=total,
            page=page,
            page_size=page_size,
            pages=math.ceil(total / page_size) if total else 0,
        )
