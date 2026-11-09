from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.api.dependencies import get_audit_query_service, require_permission
from app.domain.permissions import PermissionCode
from app.schemas.audit import AuditCategory, AuditEntry
from app.schemas.pagination import Page
from app.services.audit_query_service import AuditQueryService

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get(
    "",
    response_model=Page[AuditEntry],
    # Only roles with audit:read (by default, only the administrator).
    dependencies=[Depends(require_permission(PermissionCode.AUDIT_READ))],
)
async def list_audit_entries(
    service: Annotated[AuditQueryService, Depends(get_audit_query_service)],
    category: AuditCategory | None = None,
    search: Annotated[
        str | None, Query(max_length=100, description="User email or element ID")
    ] = None,
    start: Annotated[datetime | None, Query(alias="from")] = None,
    end: Annotated[datetime | None, Query(alias="to")] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> Page[AuditEntry]:
    """Who did what and when, newest first (RF-26). There is no endpoint to edit or delete."""
    return await service.list_entries(
        category=category, search=search, start=start, end=end, page=page, page_size=page_size
    )
