import pytest

from app.core.exceptions import BusinessRuleError
from app.domain.resource_item_ref import ResourceItemRef
from app.integrations.wialon.passengers_gateway import WialonPassengerGateway
from app.schemas.passenger import PassengerChanges
from tests.fakes import FakeWialonClient, wialon_error

RESOURCE_ID = 100
OTHER_RESOURCE_ID = 200

LAURA = {
    "id": 12,
    "n": "Laura Ríos",
    "c": "P-0012",
    "jp": {"documento": "1020304050"},
    "ck": 4321,
    "r": 1,
    "tz": -18000,
    "bu": 600123,
    "bt": 1_762_529_400,
}
PEDRO = {"id": 1, "n": "Pedro", "c": "", "jp": {}, "bu": 0}


def resource(resource_id, *tags):
    return {"id": resource_id, "tags": {str(t["id"]): t for t in tags}}


class TestRead:
    async def test_lists_tags_of_every_resource_as_passengers(self):
        client = FakeWialonClient(
            {"core/search_items": {"items": [resource(RESOURCE_ID, LAURA), resource(OTHER_RESOURCE_ID, PEDRO)]}}
        )

        passengers = await WialonPassengerGateway(client).list_passengers()

        assert [p.id for p in passengers] == ["100-12", "200-1"]
        assert client.params_of("core/search_items")[0]["flags"] == 2_097_153

    async def test_finds_one_tag_inside_its_resource(self):
        client = FakeWialonClient({"core/search_item": {"item": resource(RESOURCE_ID, PEDRO, LAURA)}})
        passenger = await WialonPassengerGateway(client).get_passenger(ResourceItemRef(RESOURCE_ID, 12))
        assert passenger is not None and passenger.name == "Laura Ríos"

    async def test_unknown_resource_is_none(self):
        client = FakeWialonClient({"core/search_item": wialon_error(7)})
        assert await WialonPassengerGateway(client).get_passenger(ResourceItemRef(999, 1)) is None


class TestWrite:
    async def test_creates_in_the_configured_resource(self):
        client = FakeWialonClient({"resource/update_tag": [13, {"id": 13, "n": "Marta", "bu": 0}]})

        passenger = await WialonPassengerGateway(client, default_resource_id=RESOURCE_ID).create_passenger(
            PassengerChanges(name="Marta")
        )

        params = client.params_of("resource/update_tag")[0]
        assert (params["callMode"], params["itemId"], params["id"]) == ("create", RESOURCE_ID, 0)
        assert passenger.id == "100-13"

    async def test_update_reads_first_and_sends_the_tag_back_complete(self):
        client = FakeWialonClient(
            {
                "core/search_item": {"item": resource(RESOURCE_ID, LAURA)},
                "resource/update_tag": [12, {**LAURA, "n": "Laura R."}],
            }
        )

        passenger = await WialonPassengerGateway(client).update_passenger(
            ResourceItemRef(RESOURCE_ID, 12), PassengerChanges(name="Laura R.")
        )

        assert [svc for svc, _ in client.calls] == ["core/search_item", "resource/update_tag"]
        params = client.params_of("resource/update_tag")[0]
        assert params["n"] == "Laura R."
        assert params["jp"] == {"documento": "1020304050"}
        assert (params["c"], params["ck"], params["tz"]) == ("P-0012", 4321, -18000)
        assert passenger is not None and passenger.name == "Laura R."

    async def test_unknown_passenger_is_not_written(self):
        client = FakeWialonClient({"core/search_item": {"item": resource(RESOURCE_ID)}})

        result = await WialonPassengerGateway(client).update_passenger(
            ResourceItemRef(RESOURCE_ID, 12), PassengerChanges(name="X")
        )

        assert result is None
        assert client.params_of("resource/update_tag") == []

    async def test_duplicate_is_a_409_conflict(self):
        client = FakeWialonClient({"resource/update_tag": wialon_error(1002)})

        with pytest.raises(BusinessRuleError) as raised:
            await WialonPassengerGateway(client, default_resource_id=RESOURCE_ID).create_passenger(
                PassengerChanges(name="Marta", code="P-0012")
            )

        assert raised.value.status_code == 409

    async def test_deletes_an_existing_passenger(self):
        client = FakeWialonClient(
            {"core/search_item": {"item": resource(RESOURCE_ID, PEDRO)}, "resource/update_tag": [1, None]}
        )

        assert await WialonPassengerGateway(client).delete_passenger(ResourceItemRef(RESOURCE_ID, 1)) is True
        assert client.params_of("resource/update_tag") == [{"itemId": RESOURCE_ID, "id": 1, "callMode": "delete"}]

    async def test_unknown_passenger_is_not_deleted(self):
        client = FakeWialonClient({"core/search_item": {"item": resource(RESOURCE_ID)}})
        assert await WialonPassengerGateway(client).delete_passenger(ResourceItemRef(RESOURCE_ID, 1)) is False


class TestBinding:
    async def test_bind_and_unbind_use_bind_unit_tag(self):
        client = FakeWialonClient({"resource/bind_unit_tag": {}})
        gateway = WialonPassengerGateway(client)

        await gateway.bind_to_vehicle(ResourceItemRef(RESOURCE_ID, 12), 600123)
        await gateway.unbind_from_vehicle(ResourceItemRef(RESOURCE_ID, 12), 600123)

        assert client.params_of("resource/bind_unit_tag") == [
            {"resourceId": RESOURCE_ID, "unitId": 600123, "tagId": 12, "time": 0, "mode": 1},
            {"resourceId": RESOURCE_ID, "unitId": 600123, "tagId": 12, "time": 0, "mode": 0},
        ]
