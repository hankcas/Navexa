import asyncio
import math
from datetime import datetime, timezone
from typing import Protocol

from app.core.exceptions import BusinessRuleError
from app.domain.vehicle_status import VehicleStatus
from app.schemas.driver import Driver
from app.schemas.pagination import Page
from app.schemas.passenger import Passenger
from app.schemas.vehicle import (
    CustomField,
    Vehicle,
    VehicleDetail,
    VehicleDriver,
    VehiclePassenger,
)


class VehicleProvider(Protocol):
    async def list_vehicles(self) -> list[Vehicle]: ...


class DriverDirectory(Protocol):
    """Only what the vehicle service needs from drivers: who is bound to which vehicle."""

    async def list_drivers(self) -> list[Driver]: ...


_OLDEST = datetime.min.replace(tzinfo=timezone.utc)


async def _no_passengers() -> list[Passenger]:
    return []


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


class VehicleCatalog(VehicleProvider, Protocol):
    """Lists vehicles and also finds one with its custom fields. Only VehicleService needs both;
    other services keep depending on the smaller VehicleProvider (interface segregation)."""

    async def get_vehicle(self, vehicle_id: int) -> tuple[Vehicle, list[CustomField]] | None: ...


class PassengerList(Protocol):
    async def list_passengers(self) -> list[Passenger]: ...


class VehicleService:
    def __init__(
        self,
        provider: VehicleCatalog,
        drivers: DriverDirectory,
        passengers: PassengerList | None = None,
    ):
        self._provider = provider
        self._drivers = drivers
        self._passengers = passengers

    async def get_vehicle_detail(self, vehicle_id: int) -> VehicleDetail:
        """Vehicle, its driver, its passengers and its custom fields (RF-12, RF-13, RF-09, RF-19)."""
        found, drivers, passengers = await asyncio.gather(
            self._provider.get_vehicle(vehicle_id),
            self._drivers.list_drivers(),
            self._passengers.list_passengers() if self._passengers else _no_passengers(),
        )
        if found is None:
            raise BusinessRuleError("El vehículo no existe.", status_code=404, title="No encontrado")

        vehicle, custom_fields = found
        riding = sorted(
            (p for p in passengers if p.vehicle_id == vehicle_id), key=lambda p: p.name.lower()
        )
        return VehicleDetail(
            **vehicle.model_dump(exclude={"driver"}),
            driver=assigned_drivers(drivers).get(vehicle_id),
            passengers=[VehiclePassenger(id=p.id, name=p.name, code=p.code) for p in riding],
            custom_fields=custom_fields,
        )

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
