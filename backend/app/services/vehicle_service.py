import asyncio
import math
from datetime import datetime, timezone
from typing import Protocol

from app.domain.vehicle_status import VehicleStatus
from app.schemas.driver import Driver
from app.schemas.pagination import Page
from app.schemas.vehicle import Vehicle, VehicleDriver


class VehicleProvider(Protocol):
    async def list_vehicles(self) -> list[Vehicle]: ...


class DriverDirectory(Protocol):
    """Only what the vehicle service needs from drivers: who is bound to which vehicle."""

    async def list_drivers(self) -> list[Driver]: ...


_OLDEST = datetime.min.replace(tzinfo=timezone.utc)


def assigned_drivers(drivers: list[Driver]) -> dict[int, VehicleDriver]:
    """Vehicle ID -> its driver. If Wialon has several bound, the most recent binding wins."""
    latest: dict[int, Driver] = {}
    for driver in drivers:
        if driver.vehicle_id is None:
            continue
        current = latest.get(driver.vehicle_id)
        if current is None or (driver.bound_at or _OLDEST) > (current.bound_at or _OLDEST):
            latest[driver.vehicle_id] = driver
    return {
        vehicle_id: VehicleDriver(id=d.id, name=d.name, phone=d.phone)
        for vehicle_id, d in latest.items()
    }


class VehicleService:
    def __init__(self, provider: VehicleProvider, drivers: DriverDirectory):
        self._provider = provider
        self._drivers = drivers

    async def list_vehicles(
        self,
        *,
        search: str | None = None,
        status: VehicleStatus | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Page[Vehicle]:
        # Both lists come from Wialon; asking for them at the same time halves the wait.
        vehicles, drivers = await asyncio.gather(
            self._provider.list_vehicles(), self._drivers.list_drivers()
        )

        if search:
            term = search.strip().lower()
            vehicles = [v for v in vehicles if term in v.name.lower()]

        if status:
            vehicles = [v for v in vehicles if v.status == status]

        total = len(vehicles)
        start = (page - 1) * page_size
        by_vehicle = assigned_drivers(drivers)
        items = [
            v.model_copy(update={"driver": by_vehicle.get(v.id)})
            for v in vehicles[start : start + page_size]
        ]
        return Page[Vehicle](
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            pages=math.ceil(total / page_size) if total else 0,
        )
