from datetime import datetime, timezone
from typing import Any

from app.domain.resource_item_ref import ResourceItemRef
from app.schemas.passenger import Passenger, PassengerChanges

# Fields our API never shows, but resource/update_tag needs back unchanged:
# image checksum and aspect ratio, and the passenger's time zone.
_HIDDEN_FIELDS_DEFAULTS: dict[str, Any] = {"ck": 0, "r": 0, "tz": 0}


def _text_or_none(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    value = value.strip()
    return value or None


def _to_utc(timestamp: Any) -> datetime | None:
    if not isinstance(timestamp, (int, float)) or timestamp <= 0:
        return None
    return datetime.fromtimestamp(timestamp, tz=timezone.utc)


def map_passenger(resource_id: int, raw: dict[str, Any]) -> Passenger:
    """Wialon tag (inside a resource) -> our Passenger model."""
    bound_unit = raw.get("bu")
    vehicle_id = bound_unit if isinstance(bound_unit, int) and bound_unit > 0 else None
    custom_fields = raw.get("jp")
    return Passenger(
        id=ResourceItemRef(resource_id, raw["id"]).public_id,
        name=_text_or_none(raw.get("n")) or f"Pasajero {raw['id']}",
        code=_text_or_none(raw.get("c")),
        custom_fields=(
            {str(k): str(v) for k, v in custom_fields.items()} if isinstance(custom_fields, dict) else {}
        ),
        vehicle_id=vehicle_id,
        bound_at=_to_utc(raw.get("bt")) if vehicle_id else None,
    )


def build_tag_params(
    ref: ResourceItemRef,
    current: dict[str, Any] | None,
    changes: PassengerChanges,
) -> dict[str, Any]:
    """Parameters for resource/update_tag in create or update mode.

    Wialon rejects a partial update (checked live: error 4), so every field is sent: the user's
    change when there is one and the current Wialon value otherwise (`current` is None when
    creating). Wialon does not store a phone for tags; "p" is sent empty only because the
    service expects it.
    """
    current = current or {}

    def pick(change: Any, wialon_key: str, default: Any) -> Any:
        return change if change is not None else current.get(wialon_key, default)

    params: dict[str, Any] = {
        "itemId": ref.resource_id,
        "id": ref.item_id,
        "callMode": "update" if current else "create",
        "n": pick(changes.name, "n", ""),
        "c": pick(changes.code, "c", ""),
        "jp": pick(changes.custom_fields, "jp", {}),
        "p": "",
    }
    for key, default in _HIDDEN_FIELDS_DEFAULTS.items():
        params[key] = current.get(key, default)
    return params
