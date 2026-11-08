from types import SimpleNamespace

import pytest

from app.core.exceptions import BusinessRuleError
from app.schemas.driver import Driver, DriverCreate, DriverUpdate
from app.services.driver_service import DriverService
from tests.fakes import FakeDriverGateway, FakeSession, FakeVehicles

ANA = Driver(id="1-1", name="Ana Gómez", code="A-100", phone="+573001234567", vehicle_id=500)
LUIS = Driver(id="1-2", name="Luis Pérez", code="L-200", phone="+573007654321")
BETO = Driver(id="1-3", name="beto Ruiz", code="B-300")

ACTOR = SimpleNamespace(id=9, email="admin@navexa.co")
IP = "127.0.0.1"


def build(*drivers, vehicle_ids=(500, 600)):
    gateway = FakeDriverGateway(*drivers)
    session = FakeSession()
    service = DriverService(gateway, FakeVehicles(*vehicle_ids), session)
    return service, gateway, session


def audit_entries(session):
    return [(entry.action, entry.entity_id, entry.details) for entry in session.added]


async def expect_error(status_code, awaitable):
    with pytest.raises(BusinessRuleError) as raised:
        await awaitable
    assert raised.value.status_code == status_code


class TestList:
    async def test_sorts_by_name_ignoring_case(self):
        service, *_ = build(LUIS, ANA, BETO)
        page = await service.list_drivers()
        assert [d.name for d in page.items] == ["Ana Gómez", "beto Ruiz", "Luis Pérez"]

    @pytest.mark.parametrize("term", ["ana", "A-100", "300123"])
    async def test_searches_name_code_and_phone(self, term):
        service, *_ = build(ANA, LUIS)
        page = await service.list_drivers(search=term)
        assert [d.id for d in page.items] == ["1-1"]

    async def test_filters_by_assignment(self):
        service, *_ = build(ANA, LUIS)
        assert [d.id for d in (await service.list_drivers(assigned=True)).items] == ["1-1"]
        assert [d.id for d in (await service.list_drivers(assigned=False)).items] == ["1-2"]

    async def test_paginates(self):
        service, *_ = build(ANA, LUIS, BETO)
        page = await service.list_drivers(page=2, page_size=2)
        assert (page.total, page.pages, [d.id for d in page.items]) == (3, 2, ["1-2"])


class TestGet:
    async def test_badly_formed_id_is_404(self):
        service, *_ = build(ANA)
        await expect_error(404, service.get_driver("no-es-un-id"))

    async def test_unknown_driver_is_404(self):
        service, *_ = build(ANA)
        await expect_error(404, service.get_driver("1-99"))


class TestCreate:
    async def test_creates_and_audits_without_personal_data(self):
        service, _, session = build(ANA)

        driver = await service.create_driver(
            ACTOR, DriverCreate(name="Marta", phone="+573009998877", custom_fields={"cedula": "55"}), IP
        )

        assert audit_entries(session) == [("drivers.created", driver.id, {"name": "Marta"})]
        assert session.commits == 1
        assert "+573009998877" not in str(session.added[0].details)

    async def test_duplicate_code_is_409_ignoring_case(self):
        service, gateway, session = build(ANA)
        await expect_error(409, service.create_driver(ACTOR, DriverCreate(name="Otro", code="a-100"), IP))
        assert len(gateway.drivers) == 1 and session.added == []

    async def test_duplicate_phone_is_409(self):
        service, *_ = build(ANA)
        await expect_error(409, service.create_driver(ACTOR, DriverCreate(name="Otro", phone="+573001234567"), IP))


class TestUpdate:
    async def test_audits_which_fields_changed_not_their_values(self):
        service, _, session = build(ANA)

        await service.update_driver(ACTOR, "1-1", DriverUpdate(phone="+573000000001", description="x"), IP)

        assert audit_entries(session) == [("drivers.updated", "1-1", {"fields": ["description", "phone"]})]

    async def test_keeping_its_own_code_is_not_a_duplicate(self):
        service, *_ = build(ANA)
        driver = await service.update_driver(ACTOR, "1-1", DriverUpdate(code="A-100", name="Ana G."), IP)
        assert driver.name == "Ana G."

    async def test_taking_another_drivers_phone_is_409(self):
        service, *_ = build(ANA, LUIS)
        await expect_error(409, service.update_driver(ACTOR, "1-2", DriverUpdate(phone="+573001234567"), IP))

    async def test_unknown_driver_is_404(self):
        service, *_ = build(ANA)
        await expect_error(404, service.update_driver(ACTOR, "1-99", DriverUpdate(name="X y"), IP))


class TestDelete:
    async def test_unbinds_the_vehicle_before_deleting(self):
        service, gateway, session = build(ANA)

        await service.delete_driver(ACTOR, "1-1", IP)

        assert gateway.events == [("unbind", "1-1", 500)]
        assert "1-1" not in gateway.drivers
        assert audit_entries(session) == [("drivers.deleted", "1-1", {"name": "Ana Gómez"})]

    async def test_unknown_driver_is_404(self):
        service, *_ = build(ANA)
        await expect_error(404, service.delete_driver(ACTOR, "1-99", IP))


class TestVehicleAssignment:
    async def test_assigns_a_free_driver(self):
        service, gateway, session = build(LUIS)

        driver = await service.assign_vehicle(ACTOR, "1-2", 600, IP)

        assert driver.vehicle_id == 600
        assert gateway.events == [("bind", "1-2", 600)]
        assert audit_entries(session) == [
            ("drivers.vehicle_assigned", "1-2", {"vehicle_id": 600, "previous_vehicle_id": None})
        ]

    async def test_moving_to_another_vehicle_leaves_the_previous_one_first(self):
        service, gateway, _ = build(ANA)
        await service.assign_vehicle(ACTOR, "1-1", 600, IP)
        assert gateway.events == [("unbind", "1-1", 500), ("bind", "1-1", 600)]

    async def test_already_assigned_to_that_vehicle_is_409(self):
        service, gateway, _ = build(ANA)
        await expect_error(409, service.assign_vehicle(ACTOR, "1-1", 500, IP))
        assert gateway.events == []

    async def test_unknown_vehicle_is_404(self):
        service, gateway, _ = build(LUIS)
        await expect_error(404, service.assign_vehicle(ACTOR, "1-2", 999, IP))
        assert gateway.events == []

    async def test_unassigns(self):
        service, gateway, session = build(ANA)

        driver = await service.unassign_vehicle(ACTOR, "1-1", IP)

        assert driver.vehicle_id is None
        assert gateway.events == [("unbind", "1-1", 500)]
        assert audit_entries(session) == [("drivers.vehicle_unassigned", "1-1", {"vehicle_id": 500})]

    async def test_unassigning_a_free_driver_is_409(self):
        service, *_ = build(LUIS)
        await expect_error(409, service.unassign_vehicle(ACTOR, "1-2", IP))
