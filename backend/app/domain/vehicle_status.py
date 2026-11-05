from datetime import datetime, timedelta, timezone
from enum import Enum


class VehicleStatus(str, Enum):
    MOVING = "moving"
    STOPPED = "stopped"
    OFFLINE = "offline"
    NO_POSITION = "no_position"


def derive_status(
    last_update: datetime | None,
    speed_kmh: float | None,
    *,
    moving_speed_kmh: float,
    offline_after: timedelta,
    now: datetime | None = None,
) -> VehicleStatus:
    if last_update is None:
        return VehicleStatus.NO_POSITION

    now = now or datetime.now(timezone.utc)
    if now - last_update > offline_after:
        return VehicleStatus.OFFLINE

    if (speed_kmh or 0) > moving_speed_kmh:
        return VehicleStatus.MOVING

    return VehicleStatus.STOPPED