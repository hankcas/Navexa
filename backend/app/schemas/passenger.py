from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.schemas.custom_fields import clean_custom_fields


class Passenger(BaseModel):
    """A passenger as our API returns it. In Wialon passengers are "tags" inside a resource.

    Wialon does not store a phone for tags, so there is none here; extra data such as an ID
    document goes in custom_fields (RF-27).
    """

    id: str
    name: str
    code: str | None = None
    custom_fields: dict[str, str] = {}
    vehicle_id: int | None = None
    bound_at: datetime | None = None


class PassengerChanges(BaseModel):
    """What a user may change in a passenger. None means "keep the current value".

    custom_fields is the full desired set: a field left out of it is deleted.
    """

    name: str | None = None
    code: str | None = None
    custom_fields: dict[str, str] | None = None


class _PassengerInput(BaseModel):
    """Validation shared by create and update (RF-28). Texts are trimmed."""

    code: str | None = Field(default=None, max_length=32)
    custom_fields: dict[str, str] | None = None

    @field_validator("code", mode="before")
    @classmethod
    def _strip(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("custom_fields")
    @classmethod
    def _check_custom_fields(cls, value: dict[str, str] | None) -> dict[str, str] | None:
        return clean_custom_fields(value)

    def to_changes(self) -> PassengerChanges:
        return PassengerChanges(**self.model_dump(exclude_unset=True))


class PassengerCreate(_PassengerInput):
    name: str = Field(min_length=2, max_length=80)

    @field_validator("name", mode="before")
    @classmethod
    def _strip_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class PassengerUpdate(_PassengerInput):
    """Only the fields present in the request change; the rest stay as they are in Wialon."""

    name: str | None = Field(default=None, min_length=2, max_length=80)

    @field_validator("name", mode="before")
    @classmethod
    def _strip_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value
