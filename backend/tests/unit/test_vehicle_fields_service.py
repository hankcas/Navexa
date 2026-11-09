from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

from app.core.exceptions import BusinessRuleError
from app.domain.vehicle_status import VehicleStatus
from app.schemas.vehicle import CustomField, CustomFieldCreate, CustomFieldUpdate, Vehicle
from app.services.vehicle_fields_service import VehicleFieldsService
from tests.fakes import FakeSession

T0 = datetime(2026, 11, 8, 15, 0, tzinfo=timezone.utc)
TRUCK = Vehicle(id=500, name="Camión 01", status=VehicleStatus.STOPPED)
ACTOR = SimpleNamespace(id=9, email="ope@navexa.co")
IP = "127.0.0.1"


class FakeFieldStore:
    """One vehicle (500) with custom fields in memory, recording every write."""

    def __init__(self, *fields: CustomField):
        self.fields = {field.id: field for field in fields}
        self.writes: list[tuple] = []
        self._next_id = 100

    async def get_vehicle(self, vehicle_id):
        return (TRUCK, list(self.fields.values())) if vehicle_id == 500 else None

    async def create_custom_field(self, vehicle_id, name, value):
        self._next_id += 1
        self.writes.append(("create", name, value))
        field = CustomField(id=self._next_id, name=name, value=value, modified_at=T0)
        self.fields[field.id] = field
        return field

    async def update_custom_field(self, vehicle_id, field_id, name, value):
        self.writes.append(("update", field_id, name, value))
        field = CustomField(id=field_id, name=name, value=value, modified_at=T0 + timedelta(minutes=5))
        self.fields[field_id] = field
        return field

    async def delete_custom_field(self, vehicle_id, field_id):
        self.writes.append(("delete", field_id))
        del self.fields[field_id]


PLATE = CustomField(id=1, name="Placa", value="ABC123", modified_at=T0)
COLOR = CustomField(id=2, name="Color", value="Rojo", modified_at=T0)


def build(*fields):
    store = FakeFieldStore(*fields)
    session = FakeSession()
    return VehicleFieldsService(store, session), store, session


async def expect_error(status_code, awaitable):
    with pytest.raises(BusinessRuleError) as raised:
        await awaitable
    assert raised.value.status_code == status_code


async def test_creates_a_field_and_audits_its_name():
    service, store, session = build(PLATE)

    field = await service.create(ACTOR, 500, CustomFieldCreate(name="Marca", value="Volvo"), IP)

    assert (field.name, field.value) == ("Marca", "Volvo")
    assert [(e.action, e.entity_id, e.details) for e in session.added] == [
        ("vehicles.custom_field_created", "500", {"field": "Marca"})
    ]


async def test_rejects_a_name_already_used_in_the_vehicle_ignoring_case():
    # Wialon itself accepts duplicates (checked live), so the service must stop them.
    service, store, _ = build(PLATE)
    await expect_error(409, service.create(ACTOR, 500, CustomFieldCreate(name="placa", value="X"), IP))
    assert store.writes == []


async def test_unknown_vehicle_is_404():
    service, *_ = build()
    await expect_error(404, service.create(ACTOR, 999, CustomFieldCreate(name="Marca"), IP))


async def test_editing_only_the_value_keeps_the_name():
    service, store, _ = build(PLATE)

    field = await service.update(ACTOR, 500, 1, CustomFieldUpdate(value="XYZ987"), IP)

    assert store.writes == [("update", 1, "Placa", "XYZ987")]
    assert field.value == "XYZ987"


async def test_renaming_to_another_fields_name_is_409():
    service, store, _ = build(PLATE, COLOR)
    await expect_error(409, service.update(ACTOR, 500, 2, CustomFieldUpdate(name="PLACA"), IP))
    assert store.writes == []


async def test_a_field_changed_elsewhere_after_the_user_loaded_it_is_a_conflict():
    service, store, _ = build(PLATE)
    seen_before_the_change = T0 - timedelta(minutes=1)

    await expect_error(
        409,
        service.update(ACTOR, 500, 1, CustomFieldUpdate(value="Z", expected_modified_at=seen_before_the_change), IP),
    )
    assert store.writes == []


async def test_saving_with_the_current_version_goes_through():
    service, store, _ = build(PLATE)
    await service.update(ACTOR, 500, 1, CustomFieldUpdate(value="Z", expected_modified_at=T0), IP)
    assert len(store.writes) == 1


async def test_deletes_an_existing_field_and_404s_an_unknown_one():
    service, store, session = build(PLATE)

    await service.delete(ACTOR, 500, 1, IP)
    await expect_error(404, service.delete(ACTOR, 500, 1, IP))

    assert store.writes == [("delete", 1)]
    assert session.added[0].action == "vehicles.custom_field_deleted"
