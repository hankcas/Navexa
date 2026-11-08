import asyncio
from collections import Counter
from datetime import datetime, timezone
from typing import Protocol

from app.domain.vehicle_status import VehicleStatus
from app.schemas.dashboard import (
    DashboardSummary,
    PeopleSummary,
    VehiclesByStatus,
    VehicleSummary,
)
from app.schemas.passenger import Passenger
from app.services.vehicle_service import DriverDirectory, VehicleProvider, assigned_drivers


class PassengerDirectory(Protocol):
    async def list_passengers(self) -> list[Passenger]: ...


class DashboardService:
    """Counts for the panel home page (RF-23). Reads only; nothing is stored."""

    def __init__(
        self,
        vehicles: VehicleProvider,
        drivers: DriverDirectory,
        passengers: PassengerDirectory,
    ):
        self._vehicles = vehicles
        self._drivers = drivers
        self._passengers = passengers

    async def summary(self) -> DashboardSummary:
        # Three independent Wialon reads: run them at the same time.
        vehicles, drivers, passengers = await asyncio.gather(
            self._vehicles.list_vehicles(),
            self._drivers.list_drivers(),
            self._passengers.list_passengers(),
        )

        statuses = Counter(vehicle.status for vehicle in vehicles)
        driver_by_vehicle = assigned_drivers(drivers)
        with_driver = sum(1 for vehicle in vehicles if vehicle.id in driver_by_vehicle)

        return DashboardSummary(
            vehicles=VehicleSummary(
                total=len(vehicles),
                by_status=VehiclesByStatus(
                    moving=statuses[VehicleStatus.MOVING],
                    stopped=statuses[VehicleStatus.STOPPED],
                    offline=statuses[VehicleStatus.OFFLINE],
                    no_position=statuses[VehicleStatus.NO_POSITION],
                ),
                with_driver=with_driver,
                without_driver=len(vehicles) - with_driver,
            ),
            drivers=PeopleSummary(
                total=len(drivers),
                assigned=sum(1 for driver in drivers if driver.vehicle_id is not None),
            ),
            passengers=PeopleSummary(
                total=len(passengers),
                assigned=sum(1 for passenger in passengers if passenger.vehicle_id is not None),
            ),
            generated_at=datetime.now(timezone.utc),
        )
