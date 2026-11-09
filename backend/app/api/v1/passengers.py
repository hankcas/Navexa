from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, Request, Response, status

from app.api.csv_response import CSV_RESPONSES, csv_response
from app.api.dependencies import get_export_service, get_passenger_service, require_permission
from app.db.models import User
from app.domain.permissions import PermissionCode
from app.schemas.pagination import Page
from app.schemas.passenger import Passenger, PassengerCreate, PassengerUpdate
from app.schemas.vehicle import VehicleAssignment
from app.services.export_service import ExportService
from app.services.passenger_service import PassengerService

router = APIRouter(prefix="/passengers", tags=["passengers"])

Reader = Annotated[User, Depends(require_permission(PermissionCode.PASSENGERS_READ))]
Writer = Annotated[User, Depends(require_permission(PermissionCode.PASSENGERS_WRITE))]
Service = Annotated[PassengerService, Depends(get_passenger_service)]
Exporter = Annotated[User, Depends(require_permission(PermissionCode.DATA_EXPORT))]
Exports = Annotated[ExportService, Depends(get_export_service)]
# "<resource>-<passenger>", e.g. "27668776-12". Anything else never reaches Wialon.
PassengerId = Annotated[str, Path(pattern=r"^\d+-\d+$", examples=["27668776-12"])]


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


@router.get("", response_model=Page[Passenger])
async def list_passengers(
    _: Reader,
    service: Service,
    search: Annotated[
        str | None, Query(max_length=100, description="Name, code or a custom field value")
    ] = None,
    assigned: Annotated[bool | None, Query(description="true: with a vehicle, false: without")] = None,
    vehicle_id: Annotated[int | None, Query(gt=0, description="Only passengers of this vehicle")] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> Page[Passenger]:
    return await service.list_passengers(
        search=search, assigned=assigned, vehicle_id=vehicle_id, page=page, page_size=page_size
    )


# Before "/{passenger_id}", so "export" is not taken as a passenger ID.
@router.get("/export", response_class=Response, responses=CSV_RESPONSES)
async def export_passengers(
    _: Reader,
    actor: Exporter,
    exports: Exports,
    request: Request,
    search: Annotated[
        str | None, Query(max_length=100, description="Name, code or a custom field value")
    ] = None,
    assigned: Annotated[bool | None, Query(description="true: with a vehicle, false: without")] = None,
) -> Response:
    """Every passenger matching the filters, as a CSV for Excel (RF-25)."""
    file = await exports.passengers(actor, search=search, assigned=assigned, ip=_client_ip(request))
    return csv_response(file)


@router.get("/{passenger_id}", response_model=Passenger)
async def get_passenger(passenger_id: PassengerId, _: Reader, service: Service) -> Passenger:
    return await service.get_passenger(passenger_id)


@router.post("", response_model=Passenger, status_code=status.HTTP_201_CREATED)
async def create_passenger(
    body: PassengerCreate, actor: Writer, service: Service, request: Request
) -> Passenger:
    return await service.create_passenger(actor, body, _client_ip(request))


@router.patch("/{passenger_id}", response_model=Passenger)
async def update_passenger(
    passenger_id: PassengerId,
    body: PassengerUpdate,
    actor: Writer,
    service: Service,
    request: Request,
) -> Passenger:
    return await service.update_passenger(actor, passenger_id, body, _client_ip(request))


@router.delete("/{passenger_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_passenger(
    passenger_id: PassengerId, actor: Writer, service: Service, request: Request
) -> Response:
    await service.delete_passenger(actor, passenger_id, _client_ip(request))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/{passenger_id}/vehicle", response_model=Passenger)
async def assign_vehicle(
    passenger_id: PassengerId,
    body: VehicleAssignment,
    actor: Writer,
    service: Service,
    request: Request,
) -> Passenger:
    return await service.assign_vehicle(actor, passenger_id, body.vehicle_id, _client_ip(request))


@router.delete("/{passenger_id}/vehicle", response_model=Passenger)
async def unassign_vehicle(
    passenger_id: PassengerId, actor: Writer, service: Service, request: Request
) -> Passenger:
    return await service.unassign_vehicle(actor, passenger_id, _client_ip(request))
