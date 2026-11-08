from datetime import datetime

from pydantic import BaseModel


class Driver(BaseModel):
    """A driver as our API returns it. Wialon's short field names never leave the backend."""

    id: str
    name: str
    code: str | None = None
    phone: str | None = None
    description: str | None = None
    custom_fields: dict[str, str] = {}
    vehicle_id: int | None = None
    bound_at: datetime | None = None


class DriverChanges(BaseModel):
    """What a user may change in a driver. None means "keep the current value".

    custom_fields is the full desired set: a field left out of it is deleted.
    """

    name: str | None = None
    code: str | None = None
    phone: str | None = None
    description: str | None = None
    custom_fields: dict[str, str] | None = None
