from datetime import datetime

from pydantic import BaseModel

from app.domain.vehicle_status import VehicleStatus


class Position(BaseModel):
    latitude: float
    longitude: float
    altitude_m: float | None = None
    heading: int | None = None
    satellites: int | None = None


class Vehicle(BaseModel):
    id: int
    name: str
    status: VehicleStatus
    speed_kmh: float | None = None
    last_update: datetime | None = None
    position: Position | None = None    