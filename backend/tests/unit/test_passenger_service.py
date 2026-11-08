from types import SimpleNamespace

import pytest

from app.core.exceptions import BusinessRuleError
from app.schemas.passenger import Passenger, PassengerCreate, PassengerUpdate
from app.services.passenger_service import PassengerService
from tests.fakes import FakePassengerGateway, FakeSession, FakeVehicles

LAURA = Passenger(id="1-1", name="Laura Ríos", code="P-1", custom_fields={"documento": "1020304050"}, vehicle_id=500)
PEDRO = Passenger(id="1-2", name="Pedro Gil", code="P-2", vehicle_id=500)
ANA = Passenger(id="1-3", name="ana Mora", code="P-3")

ACTOR = SimpleNamespace(id=9, email="admin@navexa.co")
IP = "127.0.0.1"


def build(*passengers, vehicle_ids=(500, 600)):
    gateway = FakePassengerGateway(*passengers)
    session = FakeSession()
    return PassengerService(gateway, FakeVehicles(*vehicle_ids), session), gateway, session


def audit_entries(session):
    return [(entry.action, entry.entity_id, entry.details) for entry in session.added]


async def expect_error(status_code, awaitable):
    with pytest.raises(BusinessRuleError) as raised:
        await awaitable
    assert raised.value.status_code == status_code


class TestList:
    async def test_sorts_by_name_ignoring_case(self):
        service, *_ = build(PEDRO, LAURA, ANA)
        assert [p.name for p in (await service.list_passengers()).items] == ["ana Mora", "Laura Ríos", "Pedro Gil"]

    @pytest.mark.parametrize("term", ["laura", "p-1", "10203"])
    async def test_searches_name_code_and_custom_fields(self, term):
        service, *_ = build(LAURA, PEDRO, ANA)
        assert [p.id for p in (await service.list_passengers(search=term)).items] == ["1-1"]

    async def test_lists_the_passengers_of_one_vehicle(self):
        service, *_ = build(LAURA, PEDRO, ANA)
        page = await service.list_passengers(vehicle_id=500)
        assert [p.id for p in page.items] == ["1-1", "1-2"]

    async def test_filters_by_assignment_and_paginates(self):
        service, *_ = build(LAURA, PEDRO, ANA)
        free = await service.list_passengers(assigned=False)
        second = await service.list_passengers(page=2, page_size=2)
        assert [p.id for p in free.items] == ["1-3"]
        assert (second.total, second.pages, [p.id for p in second.items]) == (3, 2, ["1-2"])


class TestCrud:
    async def test_badly_formed_or_unknown_id_is_404(self):
        service, *_ = build(LAURA)
        await expect_error(404, service.get_passenger("abc"))
        await expect_error(404, service.get_passenger("1-99"))

    async def test_creates_and_audits_only_the_name(self):
        service, _, session = build()

        passenger = await service.create_passenger(
            ACTOR, PassengerCreate(name="Marta", custom_fields={"documento": "55"}), IP
        )

        assert audit_entries(session) == [("passengers.created", passenger.id, {"name": "Marta"})]
        assert "55" not in str(session.added[0].details)

    async def test_duplicate_code_is_409_ignoring_case(self):
        service, gateway, _ = build(LAURA)
        await expect_error(409, service.create_passenger(ACTOR, PassengerCreate(name="Otra", code="p-1"), IP))
        assert len(gateway.passengers) == 1

    async def test_update_audits_field_names_not_values(self):
        service, _, session = build(LAURA)

        updated = await service.update_passenger(
            ACTOR, "1-1", PassengerUpdate(custom_fields={"documento": "999"}), IP
        )

        assert updated.custom_fields == {"documento": "999"}
        assert audit_entries(session) == [("passengers.updated", "1-1", {"fields": ["custom_fields"]})]

    async def test_keeping_its_own_code_is_not_a_duplicate(self):
        service, *_ = build(LAURA)
        assert (await service.update_passenger(ACTOR, "1-1", PassengerUpdate(code="P-1"), IP)).code == "P-1"

    async def test_delete_unbinds_first(self):
        service, gateway, session = build(LAURA)

        await service.delete_passenger(ACTOR, "1-1", IP)

        assert gateway.events == [("unbind", "1-1", 500)]
        assert audit_entries(session) == [("passengers.deleted", "1-1", {"name": "Laura Ríos"})]


class TestVehicleAssignment:
    async def test_assigns_a_free_passenger(self):
        service, gateway, session = build(ANA)

        passenger = await service.assign_vehicle(ACTOR, "1-3", 600, IP)

        assert passenger.vehicle_id == 600
        assert gateway.events == [("bind", "1-3", 600)]
        assert audit_entries(session) == [
            ("passengers.vehicle_assigned", "1-3", {"vehicle_id": 600, "previous_vehicle_id": None})
        ]

    async def test_a_vehicle_can_carry_several_passengers(self):
        service, *_ = build(LAURA, ANA)
        await service.assign_vehicle(ACTOR, "1-3", 500, IP)
        assert (await service.list_passengers(vehicle_id=500)).total == 2

    async def test_moving_to_another_vehicle_leaves_the_previous_one(self):
        service, gateway, _ = build(LAURA)
        await service.assign_vehicle(ACTOR, "1-1", 600, IP)
        assert gateway.events == [("unbind", "1-1", 500), ("bind", "1-1", 600)]

    async def test_already_assigned_is_409_and_unknown_vehicle_is_404(self):
        service, gateway, _ = build(LAURA)
        await expect_error(409, service.assign_vehicle(ACTOR, "1-1", 500, IP))
        await expect_error(404, service.assign_vehicle(ACTOR, "1-1", 999, IP))
        assert gateway.events == []

    async def test_unassigns_and_rejects_a_free_passenger(self):
        service, gateway, _ = build(LAURA, ANA)

        assert (await service.unassign_vehicle(ACTOR, "1-1", IP)).vehicle_id is None
        await expect_error(409, service.unassign_vehicle(ACTOR, "1-3", IP))
        assert gateway.events == [("unbind", "1-1", 500)]
