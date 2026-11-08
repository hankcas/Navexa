from datetime import datetime

from pydantic import BaseModel, Field

from app.domain.vehicle_status import VehicleStatus


class Position(BaseModel):
    latitude: float
    longitude: float
    altitude_m: float | None = None
    heading: int | None = None
    satellites: int | None = None


class VehicleDriver(BaseModel):
    """The driver bound to a vehicle in Wialon, enough to show it in a list or popup (RF-13)."""

    id: str
    name: str
    phone: str | None = None


class Vehicle(BaseModel):
    id: int
    name: str
    status: VehicleStatus
    speed_kmh: float | None = None
    last_update: datetime | None = None
    position: Position | None = None
    # None means no driver is bound to the vehicle in Wialon.
    driver: VehicleDriver | None = None


class VehicleAssignment(BaseModel):
    """Body to assign a driver or a passenger to a vehicle."""

    vehicle_id: int = Field(gt=0)
