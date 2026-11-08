from datetime import datetime, timezone

from app.domain.vehicle_status import VehicleStatus
from app.schemas.driver import Driver
from app.schemas.vehicle import Vehicle
from app.services.vehicle_service import VehicleService, assigned_drivers


def vehicle(vehicle_id: int, name: str, status: VehicleStatus = VehicleStatus.STOPPED) -> Vehicle:
    return Vehicle(id=vehicle_id, name=name, status=status)


def at(hour: int) -> datetime:
    return datetime(2026, 11, 7, hour, tzinfo=timezone.utc)


TRUCK = vehicle(500, "Camión 01", VehicleStatus.MOVING)
VAN = vehicle(600, "Van 07")
ANA = Driver(id="1-1", name="Ana Gómez", phone="+573001234567", vehicle_id=500, bound_at=at(8))
LUIS = Driver(id="1-2", name="Luis Pérez")


class StaticVehicles:
    def __init__(self, *vehicles: Vehicle):
        self._vehicles = list(vehicles)

    async def list_vehicles(self):
        return self._vehicles


class StaticDrivers:
    def __init__(self, *drivers: Driver):
        self._drivers = list(drivers)

    async def list_drivers(self):
        return self._drivers


async def test_each_vehicle_shows_its_bound_driver():
    service = VehicleService(StaticVehicles(TRUCK, VAN), StaticDrivers(ANA, LUIS))

    page = await service.list_vehicles()

    truck, van = page.items
    assert truck.driver is not None
    assert (truck.driver.id, truck.driver.name, truck.driver.phone) == ("1-1", "Ana Gómez", "+573001234567")
    # RF-13: a vehicle without a bound driver says so with null, the UI tells the user.
    assert van.driver is None


async def test_filters_and_pagination_still_apply():
    service = VehicleService(StaticVehicles(TRUCK, VAN), StaticDrivers(ANA))

    moving = await service.list_vehicles(status=VehicleStatus.MOVING)
    searched = await service.list_vehicles(search="van")
    second_page = await service.list_vehicles(page=2, page_size=1)

    assert [v.id for v in moving.items] == [500]
    assert [v.id for v in searched.items] == [600]
    assert (second_page.total, second_page.pages, [v.id for v in second_page.items]) == (2, 2, [600])


def test_most_recent_binding_wins_when_wialon_has_several():
    earlier = Driver(id="1-3", name="Beto", vehicle_id=500, bound_at=at(6))
    later = ANA

    assert assigned_drivers([later, earlier])[500].id == "1-1"
    assert assigned_drivers([earlier, later])[500].id == "1-1"


def test_unbound_drivers_are_ignored():
    assert assigned_drivers([LUIS]) == {}
