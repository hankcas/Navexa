import re
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.schemas.custom_fields import clean_custom_fields

# Wialon stores phones as "+1234567890": an optional "+" and 7 to 15 digits (E.164).
_PHONE = re.compile(r"^\+?\d{7,15}$")


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


class _DriverInput(BaseModel):
    """Validation shared by create and update (RF-18). Texts are trimmed."""

    code: str | None = Field(default=None, max_length=32)
    phone: str | None = Field(default=None, max_length=16)
    description: str | None = Field(default=None, max_length=200)
    custom_fields: dict[str, str] | None = None

    @field_validator("code", "phone", "description", mode="before")
    @classmethod
    def _strip(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("phone")
    @classmethod
    def _check_phone(cls, value: str | None) -> str | None:
        # An empty string is allowed: it clears the phone.
        if value and not _PHONE.fullmatch(value):
            raise ValueError("El teléfono debe tener entre 7 y 15 dígitos, con + opcional al inicio.")
        return value

    @field_validator("custom_fields")
    @classmethod
    def _check_custom_fields(cls, value: dict[str, str] | None) -> dict[str, str] | None:
        return clean_custom_fields(value)

    def to_changes(self) -> DriverChanges:
        return DriverChanges(**self.model_dump(exclude_unset=True))


class DriverCreate(_DriverInput):
    name: str = Field(min_length=2, max_length=80)

    @field_validator("name", mode="before")
    @classmethod
    def _strip_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class DriverUpdate(_DriverInput):
    """Only the fields present in the request change; the rest stay as they are in Wialon."""

    name: str | None = Field(default=None, min_length=2, max_length=80)

    @field_validator("name", mode="before")
    @classmethod
    def _strip_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

