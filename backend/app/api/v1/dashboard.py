from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.dependencies import get_dashboard_service, require_permission
from app.domain.permissions import PermissionCode
from app.schemas.dashboard import DashboardSummary
from app.services.dashboard_service import DashboardService

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get(
    "/summary",
    response_model=DashboardSummary,
    # Section 5.3: every role sees the dashboard. It also counts drivers and passengers,
    # which every role can read as well.
    dependencies=[
        Depends(require_permission(PermissionCode.VEHICLES_READ)),
        Depends(require_permission(PermissionCode.DRIVERS_READ)),
        Depends(require_permission(PermissionCode.PASSENGERS_READ)),
    ],
)
async def summary(
    service: Annotated[DashboardService, Depends(get_dashboard_service)],
) -> DashboardSummary:
    return await service.summary()
