from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, Request, Response, status

from app.api.dependencies import get_driver_service, require_permission
from app.db.models import User
from app.domain.permissions import PermissionCode
from app.schemas.driver import Driver, DriverCreate, DriverUpdate, VehicleAssignment
from app.schemas.pagination import Page
from app.services.driver_service import DriverService

router = APIRouter(prefix="/drivers", tags=["drivers"])

Reader = Annotated[User, Depends(require_permission(PermissionCode.DRIVERS_READ))]
Writer = Annotated[User, Depends(require_permission(PermissionCode.DRIVERS_WRITE))]
Service = Annotated[DriverService, Depends(get_driver_service)]
# "<resource>-<driver>", e.g. "27668776-7". Anything else never reaches Wialon.
DriverId = Annotated[str, Path(pattern=r"^\d+-\d+$", examples=["27668776-7"])]


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


@router.get("", response_model=Page[Driver])
async def list_drivers(
    _: Reader,
    service: Service,
    search: Annotated[str | None, Query(max_length=100, description="Name, code or phone")] = None,
    assigned: Annotated[bool | None, Query(description="true: with a vehicle, false: without")] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> Page[Driver]:
    return await service.list_drivers(
        search=search, assigned=assigned, page=page, page_size=page_size
    )


@router.get("/{driver_id}", response_model=Driver)
async def get_driver(driver_id: DriverId, _: Reader, service: Service) -> Driver:
    return await service.get_driver(driver_id)


@router.post("", response_model=Driver, status_code=status.HTTP_201_CREATED)
async def create_driver(
    body: DriverCreate, actor: Writer, service: Service, request: Request
) -> Driver:
    return await service.create_driver(actor, body, _client_ip(request))


@router.patch("/{driver_id}", response_model=Driver)
async def update_driver(
    driver_id: DriverId, body: DriverUpdate, actor: Writer, service: Service, request: Request
) -> Driver:
    return await service.update_driver(actor, driver_id, body, _client_ip(request))


@router.delete("/{driver_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_driver(
    driver_id: DriverId, actor: Writer, service: Service, request: Request
) -> Response:
    await service.delete_driver(actor, driver_id, _client_ip(request))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/{driver_id}/vehicle", response_model=Driver)
async def assign_vehicle(
    driver_id: DriverId,
    body: VehicleAssignment,
    actor: Writer,
    service: Service,
    request: Request,
) -> Driver:
    return await service.assign_vehicle(actor, driver_id, body.vehicle_id, _client_ip(request))


@router.delete("/{driver_id}/vehicle", response_model=Driver)
async def unassign_vehicle(
    driver_id: DriverId, actor: Writer, service: Service, request: Request
) -> Driver:
    return await service.unassign_vehicle(actor, driver_id, _client_ip(request))
