from datetime import datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel


class AuditCategory(StrEnum):
    """The first part of every action ("drivers.created" -> drivers), used to filter."""

    AUTH = "auth"
    USERS = "users"
    VEHICLES = "vehicles"
    DRIVERS = "drivers"
    PASSENGERS = "passengers"


class AuditEntry(BaseModel):
    """One line of the audit log as the API returns it (RF-26). Read only: the API has no way to
    change or delete entries."""

    id: int
    created_at: datetime
    actor_email: str | None
    action: str
    entity_type: str | None
    entity_id: str | None
    details: dict[str, Any] | None
    ip_address: str | None
