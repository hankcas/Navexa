from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, Request, Response, status

from app.api.csv_response import CSV_RESPONSES, csv_response
from app.api.dependencies import (
    get_export_service,
    get_track_service,
    get_vehicle_fields_service,
    get_vehicle_service,
    require_permission,
)
from app.db.models import User
from app.domain.permissions import PermissionCode
from app.domain.vehicle_status import VehicleStatus
from app.schemas.pagination import Page
from app.schemas.track import VehicleTrack
from app.schemas.vehicle import (
    CustomField,
    CustomFieldCreate,
    CustomFieldUpdate,
    Vehicle,
    VehicleDetail,
)
from app.services.export_service import ExportService
from app.services.track_service import TrackService
from app.services.vehicle_fields_service import VehicleFieldsService
from app.services.vehicle_service import VehicleService

router = APIRouter(prefix="/vehicles", tags=["vehicles"])

Writer = Annotated[User, Depends(require_permission(PermissionCode.VEHICLES_WRITE))]
Exporter = Annotated[User, Depends(require_permission(PermissionCode.DATA_EXPORT))]
Exports = Annotated[ExportService, Depends(get_export_service)]
Fields = Annotated[VehicleFieldsService, Depends(get_vehicle_fields_service)]
VehicleId = Annotated[int, Path(gt=0)]
FieldId = Annotated[int, Path(gt=0)]


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


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


# Declared before "/{vehicle_id}": FastAPI tries routes in order, and "export" would otherwise
# be taken as a vehicle ID (and rejected for not being a number).
@router.get(
    "/export",
    response_class=Response,
    responses=CSV_RESPONSES,
    dependencies=[Depends(require_permission(PermissionCode.VEHICLES_READ))],
)
async def export_vehicles(
    actor: Exporter,
    exports: Exports,
    request: Request,
    search: Annotated[str | None, Query(max_length=100)] = None,
    status: VehicleStatus | None = None,
) -> Response:
    """Every vehicle matching the filters, as a CSV for Excel (RF-25)."""
    file = await exports.vehicles(actor, search=search, status=status, ip=_client_ip(request))
    return csv_response(file)


@router.get(
    "/{vehicle_id}",
    response_model=VehicleDetail,
    dependencies=[
        Depends(require_permission(PermissionCode.VEHICLES_READ)),
        Depends(require_permission(PermissionCode.DRIVERS_READ)),
        Depends(require_permission(PermissionCode.PASSENGERS_READ)),
    ],
)
async def get_vehicle(
    vehicle_id: VehicleId,
    service: Annotated[VehicleService, Depends(get_vehicle_service)],
) -> VehicleDetail:
    return await service.get_vehicle_detail(vehicle_id)


@router.get(
    "/{vehicle_id}/track",
    response_model=VehicleTrack,
    dependencies=[
        Depends(require_permission(PermissionCode.VEHICLES_READ)),
        Depends(require_permission(PermissionCode.HISTORY_READ)),
    ],
)
async def get_vehicle_track(
    vehicle_id: VehicleId,
    service: Annotated[TrackService, Depends(get_track_service)],
    start: Annotated[datetime, Query(alias="from", description="Inicio del rango (ISO 8601).")],
    end: Annotated[datetime, Query(alias="to", description="Fin del rango (ISO 8601).")],
) -> VehicleTrack:
    """Route between two dates, simplified for drawing and playback (RF-24)."""
    return await service.get_track(vehicle_id, start, end)


@router.post(
    "/{vehicle_id}/custom-fields",
    response_model=CustomField,
    status_code=status.HTTP_201_CREATED,
)
async def create_custom_field(
    vehicle_id: VehicleId, body: CustomFieldCreate, actor: Writer, fields: Fields, request: Request
) -> CustomField:
    return await fields.create(actor, vehicle_id, body, _client_ip(request))


@router.patch("/{vehicle_id}/custom-fields/{field_id}", response_model=CustomField)
async def update_custom_field(
    vehicle_id: VehicleId,
    field_id: FieldId,
    body: CustomFieldUpdate,
    actor: Writer,
    fields: Fields,
    request: Request,
) -> CustomField:
    return await fields.update(actor, vehicle_id, field_id, body, _client_ip(request))


@router.delete(
    "/{vehicle_id}/custom-fields/{field_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_custom_field(
    vehicle_id: VehicleId, field_id: FieldId, actor: Writer, fields: Fields, request: Request
) -> Response:
    await fields.delete(actor, vehicle_id, field_id, _client_ip(request))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
