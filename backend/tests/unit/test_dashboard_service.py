from app.domain.vehicle_status import VehicleStatus
from app.schemas.driver import Driver
from app.schemas.passenger import Passenger
from app.schemas.vehicle import Vehicle
from app.services.dashboard_service import DashboardService


class Static:
    """Answers list_vehicles, list_drivers or list_passengers with fixed data."""

    def __init__(self, items):
        self._items = items

    async def list_vehicles(self):
        return self._items

    async def list_drivers(self):
        return self._items

    async def list_passengers(self):
        return self._items


def vehicle(vehicle_id: int, status: VehicleStatus) -> Vehicle:
    return Vehicle(id=vehicle_id, name=f"V{vehicle_id}", status=status)


VEHICLES = [
    vehicle(1, VehicleStatus.MOVING),
    vehicle(2, VehicleStatus.MOVING),
    vehicle(3, VehicleStatus.STOPPED),
    vehicle(4, VehicleStatus.OFFLINE),
    vehicle(5, VehicleStatus.NO_POSITION),
]
DRIVERS = [
    Driver(id="1-1", name="Ana", vehicle_id=1),
    Driver(id="1-2", name="Beto", vehicle_id=3),
    # Bound to a vehicle the account cannot see: counts as assigned, not as a fleet vehicle.
    Driver(id="1-3", name="Carla", vehicle_id=999),
    Driver(id="1-4", name="Dario"),
]
PASSENGERS = [
    Passenger(id="1-10", name="Laura", vehicle_id=1),
    Passenger(id="1-11", name="Pedro", vehicle_id=1),
    Passenger(id="1-12", name="Sara"),
]


async def test_counts_vehicles_by_status_and_driver():
    summary = await DashboardService(Static(VEHICLES), Static(DRIVERS), Static(PASSENGERS)).summary()

    assert summary.vehicles.total == 5
    assert summary.vehicles.by_status.model_dump() == {
        "moving": 2,
        "stopped": 1,
        "offline": 1,
        "no_position": 1,
    }
    assert (summary.vehicles.with_driver, summary.vehicles.without_driver) == (2, 3)


async def test_counts_drivers_and_passengers():
    summary = await DashboardService(Static(VEHICLES), Static(DRIVERS), Static(PASSENGERS)).summary()

    assert (summary.drivers.total, summary.drivers.assigned) == (4, 3)
    assert (summary.passengers.total, summary.passengers.assigned) == (3, 2)


async def test_an_empty_fleet_gives_zeros_not_errors():
    summary = await DashboardService(Static([]), Static([]), Static([])).summary()

    assert summary.vehicles.total == 0
    assert summary.vehicles.by_status.model_dump() == {"moving": 0, "stopped": 0, "offline": 0, "no_position": 0}
    assert summary.drivers.total == summary.passengers.total == 0
