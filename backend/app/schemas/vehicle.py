from datetime import datetime

from pydantic import BaseModel, Field, field_validator

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


class CustomField(BaseModel):
    """A custom field of a vehicle, stored in Wialon (RF-19)."""

    id: int
    name: str
    value: str
    # When it last changed in Wialon: lets the UI detect edits made elsewhere (RF-22).
    modified_at: datetime | None = None


class VehiclePassenger(BaseModel):
    id: str
    name: str
    code: str | None = None


class VehicleDetail(Vehicle):
    """Everything the vehicle page shows (RF-12, RF-13, RF-09, RF-19)."""

    passengers: list[VehiclePassenger] = []
    custom_fields: list[CustomField] = []


class _CustomFieldInput(BaseModel):
    @field_validator("name", "value", mode="before", check_fields=False)
    @classmethod
    def _strip(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class CustomFieldCreate(_CustomFieldInput):
    name: str = Field(min_length=1, max_length=50)
    value: str = Field(default="", max_length=200)


class CustomFieldUpdate(_CustomFieldInput):
    name: str | None = Field(default=None, min_length=1, max_length=50)
    value: str | None = Field(default=None, max_length=200)
    # Optional: the modified_at the user saw. If Wialon has a newer one, the save is refused.
    expected_modified_at: datetime | None = None
