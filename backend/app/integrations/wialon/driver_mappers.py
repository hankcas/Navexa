from datetime import datetime, timezone
from typing import Any

from app.domain.driver_ref import DriverRef
from app.schemas.driver import Driver, DriverChanges

# Fields our API never shows, but resource/update_driver needs back unchanged:
# mobile app password, extended JSON, flags (4 = exclusive), image checksum and aspect ratio.
_HIDDEN_FIELDS_DEFAULTS: dict[str, Any] = {"pwd": "", "ej": {}, "f": 0, "ck": 0, "r": 0}


def _text_or_none(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    value = value.strip()
    return value or None


def _to_utc(timestamp: Any) -> datetime | None:
    if not isinstance(timestamp, (int, float)) or timestamp <= 0:
        return None
    return datetime.fromtimestamp(timestamp, tz=timezone.utc)


def _custom_fields(raw: Any) -> dict[str, str]:
    if not isinstance(raw, dict):
        return {}
    return {str(name): str(value) for name, value in raw.items()}


def map_driver(resource_id: int, raw: dict[str, Any]) -> Driver:
    """Wialon driver (inside a resource) -> our Driver model."""
    bound_unit = raw.get("bu")
    vehicle_id = bound_unit if isinstance(bound_unit, int) and bound_unit > 0 else None
    return Driver(
        id=DriverRef(resource_id, raw["id"]).public_id,
        name=_text_or_none(raw.get("n")) or f"Conductor {raw['id']}",
        code=_text_or_none(raw.get("c")),
        phone=_text_or_none(raw.get("p")),
        description=_text_or_none(raw.get("ds")),
        custom_fields=_custom_fields(raw.get("jp")),
        vehicle_id=vehicle_id,
        bound_at=_to_utc(raw.get("bt")) if vehicle_id else None,
    )


def build_driver_params(
    ref: DriverRef,
    current: dict[str, Any] | None,
    changes: DriverChanges,
) -> dict[str, Any]:
    """Parameters for resource/update_driver in create or update mode.

    Wialon replaces the whole driver with what it receives: a field left out is erased.
    So every field is sent, taking the user's change when there is one and the current
    Wialon value otherwise (`current` is None when creating).
    """
    current = current or {}

    def pick(change: Any, wialon_key: str, default: Any) -> Any:
        return change if change is not None else current.get(wialon_key, default)

    params: dict[str, Any] = {
        "itemId": ref.resource_id,
        "id": ref.driver_id,
        "callMode": "update" if current else "create",
        "n": pick(changes.name, "n", ""),
        "c": pick(changes.code, "c", ""),
        "p": pick(changes.phone, "p", ""),
        "ds": pick(changes.description, "ds", ""),
        "jp": pick(changes.custom_fields, "jp", {}),
    }
    for key, default in _HIDDEN_FIELDS_DEFAULTS.items():
        params[key] = current.get(key, default)
    return params
