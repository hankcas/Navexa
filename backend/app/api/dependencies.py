from datetime import timedelta

from fastapi import Request

from app.core.config import settings
from app.integrations.wialon.units_gateway import WialonUnitGateway
from app.services.vehicle_service import VehicleService


def get_vehicle_service(request: Request) -> VehicleService:
    gateway = WialonUnitGateway(
        request.app.state.wialon_client,
        moving_speed_kmh=settings.status_moving_speed_kmh,
        offline_after=timedelta(minutes=settings.status_offline_minutes),
    )
    return VehicleService(gateway)