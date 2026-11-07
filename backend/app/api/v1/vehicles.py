from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.api.dependencies import get_vehicle_service, require_permission
from app.domain.permissions import PermissionCode
from app.domain.vehicle_status import VehicleStatus
from app.schemas.pagination import Page
from app.schemas.vehicle import Vehicle
from app.services.vehicle_service import VehicleService

router = APIRouter(prefix="/vehicles", tags=["vehicles"])


@router.get(
    "",
    response_model=Page[Vehicle],
    dependencies=[Depends(require_permission(PermissionCode.VEHICLES_READ))],
)
async def list_vehicles(
    service: Annotated[VehicleService, Depends(get_vehicle_service)],
    search: Annotated[str | None, Query(max_length=100)] = None,
    status: VehicleStatus | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> Page[Vehicle]:
    return await service.list_vehicles(
        search=search, status=status, page=page, page_size=page_size
    )