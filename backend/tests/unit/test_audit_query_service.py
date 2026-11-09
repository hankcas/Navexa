from datetime import datetime, timezone
from types import SimpleNamespace

import pytest

from app.core.exceptions import BusinessRuleError
from app.schemas.audit import AuditCategory
from app.services.audit_query_service import AuditQueryService

AT = datetime(2026, 11, 8, 15, tzinfo=timezone.utc)


def row(entry_id: int, action: str, **extra):
    """Looks like an AuditLog row: the service reads its attributes."""
    values = dict(
        id=entry_id,
        created_at=AT,
        actor_email="admin@navexa.co",
        action=action,
        entity_type=None,
        entity_id=None,
        details=None,
        ip_address="10.0.0.1",
    )
    return SimpleNamespace(**(values | extra))


class FakeAuditRepository:
    def __init__(self, rows, total=None):
        self._rows = rows
        self._total = len(rows) if total is None else total
        self.calls: list[dict] = []

    async def list_page(self, **filters):
        self.calls.append(filters)
        return self._rows, self._total


async def test_returns_a_page_of_entries_with_their_details():
    repository = FakeAuditRepository(
        [row(2, "drivers.created", entity_type="driver", entity_id="1-7", details={"name": "Ana"})],
        total=41,
    )
    page = await AuditQueryService(repository).list_entries(page=3, page_size=20)

    assert page.total == 41 and page.pages == 3 and page.page == 3
    assert page.items[0].action == "drivers.created"
    assert page.items[0].details == {"name": "Ana"}
    assert repository.calls[0]["offset"] == 40 and repository.calls[0]["limit"] == 20


async def test_passes_the_filters_to_the_database_query():
    repository = FakeAuditRepository([])
    await AuditQueryService(repository).list_entries(
        category=AuditCategory.AUTH,
        search="  admin@  ",
        start=datetime(2026, 11, 8, 5),
        end=datetime(2026, 11, 9, 5, tzinfo=timezone.utc),
    )

    filters = repository.calls[0]
    assert filters["category"] is AuditCategory.AUTH
    assert filters["search"] == "admin@"
    # A date without time zone is taken as UTC.
    assert filters["start"] == datetime(2026, 11, 8, 5, tzinfo=timezone.utc)


async def test_a_blank_search_is_no_filter():
    repository = FakeAuditRepository([])
    await AuditQueryService(repository).list_entries(search="   ")
    assert repository.calls[0]["search"] is None


async def test_an_empty_log_has_no_pages():
    page = await AuditQueryService(FakeAuditRepository([])).list_entries()
    assert page.total == 0 and page.pages == 0 and page.items == []


async def test_rejects_an_end_before_the_start():
    with pytest.raises(BusinessRuleError, match="posterior"):
        await AuditQueryService(FakeAuditRepository([])).list_entries(start=AT, end=AT)
