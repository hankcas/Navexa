from datetime import datetime, timedelta, timezone
from typing import Any

from app.domain.vehicle_status import derive_status
from app.schemas.vehicle import Position, Vehicle


def _to_utc(timestamp: Any) -> datetime | None:
    if not isinstance(timestamp, (int, float)) or timestamp <= 0:
        return None
    return datetime.fromtimestamp(timestamp, tz=timezone.utc)


def _to_position(raw_pos: dict[str, Any]) -> Position | None:
    lat = raw_pos.get("y")
    lon = raw_pos.get("x")
    if not isinstance(lat, (int, float)) or not isinstance(lon, (int, float)):
        return None
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        return None
    if lat == 0 and lon == 0:
        return None
    return Position(
        latitude=lat,
        longitude=lon,
        altitude_m=raw_pos.get("z"),
        heading=raw_pos.get("c"),
        satellites=raw_pos.get("sc"),
    )


def map_unit_to_vehicle(
    raw_unit: dict[str, Any],
    *,
    moving_speed_kmh: float,
    offline_after: timedelta,
    now: datetime | None = None,
) -> Vehicle:
    raw_pos = raw_unit.get("pos") or {}
    position = _to_position(raw_pos) if raw_pos else None
    last_update = _to_utc(raw_pos.get("t")) if position else None
    speed_kmh = raw_pos.get("s") if position else None

    return Vehicle(
        id=raw_unit["id"],
        name=raw_unit.get("nm") or f"Unidad {raw_unit['id']}",
        status=derive_status(
            last_update,
            speed_kmh,
            moving_speed_kmh=moving_speed_kmh,
            offline_after=offline_after,
            now=now,
        ),
        speed_kmh=speed_kmh,
        last_update=last_update,
        position=position,
    )