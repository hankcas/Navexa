from types import SimpleNamespace

from app.domain.vehicle_status import VehicleStatus
from app.schemas.driver import Driver
from app.schemas.passenger import Passenger
from app.services.driver_service import DriverService
from app.services.export_service import ExportService
from app.services.passenger_service import PassengerService
from app.services.vehicle_service import VehicleService
from tests.fakes import FakeSession
from tests.unit.test_vehicle_service import StaticDrivers, StaticPassengers, StaticVehicles, vehicle

TRUCK = vehicle(500, "Camión 01", VehicleStatus.MOVING)
VAN = vehicle(600, "Van 07")
ANA = Driver(id="1-1", name="Ana Gómez", vehicle_id=500)
LUIS = Driver(id="1-2", name="Luis Pérez")
SARA = Passenger(id="1-12", name="Sara", vehicle_id=600)
ACTOR = SimpleNamespace(id=7, email="operador@navexa.co")


def service(session: FakeSession) -> ExportService:
    vehicles = StaticVehicles(TRUCK, VAN)
    drivers = StaticDrivers(ANA, LUIS)
    return ExportService(
        VehicleService(vehicles, drivers),
        DriverService(drivers, vehicles, session),
        PassengerService(StaticPassengers(SARA), vehicles, session),
        session,
    )


def lines(content: str) -> list[str]:
    return content.removeprefix("﻿").strip().split("\r\n")


async def test_the_file_has_the_same_rows_as_the_filtered_list():
    file = await service(FakeSession()).vehicles(
        ACTOR, search=None, status=VehicleStatus.MOVING, ip="10.0.0.1"
    )
    assert file.rows == 1
    assert lines(file.content)[1].startswith("Camión 01;En movimiento")
    assert file.filename.startswith("vehiculos-") and file.filename.endswith(".csv")


async def test_every_download_is_written_to_the_audit_log():
    session = FakeSession()
    await service(session).drivers(ACTOR, search="ana", assigned=None, ip="10.0.0.1")

    [entry] = session.added
    assert entry.action == "drivers.exported"
    assert entry.actor_id == 7
    assert entry.entity_type == "driver"
    assert entry.details == {"rows": 1, "filters": {"search": "ana"}}
    assert entry.ip_address == "10.0.0.1"
    assert session.commits == 1


async def test_drivers_and_passengers_show_vehicle_names_not_ids():
    exports = service(FakeSession())
    drivers = await exports.drivers(ACTOR, search=None, assigned=True, ip=None)
    passengers = await exports.passengers(ACTOR, search=None, assigned=None, ip=None)

    assert lines(drivers.content)[1:] == ["Ana Gómez;;;;Camión 01;;"]
    assert lines(passengers.content)[1:] == ["Sara;;Van 07;;"]
