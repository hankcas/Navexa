import pytest

from app.core.exceptions import BusinessRuleError
from app.domain.resource_item_ref import ResourceItemRef
from app.integrations.wialon.drivers_gateway import WialonDriverGateway
from app.integrations.wialon.exceptions import WialonError
from app.schemas.driver import DriverChanges
from tests.fakes import FakeWialonClient, wialon_error

RESOURCE_ID = 100
OTHER_RESOURCE_ID = 200

ANA = {
    "id": 7,
    "n": "Ana Gómez",
    "c": "A-100",
    "p": "+573001234567",
    "ds": "",
    "jp": {"cedula": "1020304050"},
    "ej": {},
    "pwd": "app-pass",
    "f": 4,
    "ck": 0,
    "r": 0,
    "bu": 600123,
    "bt": 1_762_529_400,
}
LUIS = {"id": 1, "n": "Luis", "jp": {}, "bu": 0}


def resource(resource_id, *drivers):
    return {"id": resource_id, "nm": f"Recurso {resource_id}", "drvrs": {str(d["id"]): d for d in drivers}}


def search_items(*resources):
    return {"items": list(resources)}


def search_item(item):
    return {"item": item}


class TestListDrivers:
    async def test_lists_drivers_of_every_resource(self):
        client = FakeWialonClient(
            {"core/search_items": search_items(resource(RESOURCE_ID, ANA), resource(OTHER_RESOURCE_ID, LUIS))}
        )
        drivers = await WialonDriverGateway(client).list_drivers()

        assert [d.id for d in drivers] == ["100-7", "200-1"]
        assert client.params_of("core/search_items")[0]["flags"] == 257

    async def test_resource_without_drivers_gives_an_empty_list(self):
        client = FakeWialonClient({"core/search_items": search_items({"id": RESOURCE_ID})})
        assert await WialonDriverGateway(client).list_drivers() == []


class TestGetDriver:
    async def test_finds_the_driver_inside_its_resource(self):
        client = FakeWialonClient({"core/search_item": search_item(resource(RESOURCE_ID, LUIS, ANA))})
        driver = await WialonDriverGateway(client).get_driver(ResourceItemRef(RESOURCE_ID, 7))
        assert driver is not None and driver.name == "Ana Gómez"

    async def test_unknown_driver_is_none(self):
        client = FakeWialonClient({"core/search_item": search_item(resource(RESOURCE_ID, LUIS))})
        assert await WialonDriverGateway(client).get_driver(ResourceItemRef(RESOURCE_ID, 99)) is None

    async def test_unknown_resource_is_none(self):
        client = FakeWialonClient({"core/search_item": wialon_error(7)})
        assert await WialonDriverGateway(client).get_driver(ResourceItemRef(999, 1)) is None

    async def test_other_wialon_errors_are_not_hidden(self):
        client = FakeWialonClient({"core/search_item": wialon_error(5)})
        with pytest.raises(WialonError):
            await WialonDriverGateway(client).get_driver(ResourceItemRef(RESOURCE_ID, 1))


class TestCreateDriver:
    async def test_creates_in_the_configured_resource(self):
        created = {"id": 8, "n": "Marta", "jp": {}, "bu": 0}
        client = FakeWialonClient({"resource/update_driver": [8, created]})

        driver = await WialonDriverGateway(client, default_resource_id=RESOURCE_ID).create_driver(
            DriverChanges(name="Marta")
        )

        params = client.params_of("resource/update_driver")[0]
        assert params["callMode"] == "create"
        assert params["itemId"] == RESOURCE_ID
        assert params["id"] == 0
        assert driver.id == "100-8"

    async def test_without_configuration_uses_the_first_resource(self):
        client = FakeWialonClient(
            {
                "core/search_items": search_items(resource(OTHER_RESOURCE_ID), resource(RESOURCE_ID)),
                "resource/update_driver": [1, {"id": 1, "n": "Marta"}],
            }
        )
        await WialonDriverGateway(client).create_driver(DriverChanges(name="Marta"))
        assert client.params_of("resource/update_driver")[0]["itemId"] == OTHER_RESOURCE_ID


class TestUpdateDriver:
    async def test_reads_the_driver_first_and_sends_it_back_complete(self):
        client = FakeWialonClient(
            {
                "core/search_item": search_item(resource(RESOURCE_ID, ANA)),
                "resource/update_driver": [7, {**ANA, "p": "+573009999999"}],
            }
        )

        driver = await WialonDriverGateway(client).update_driver(
            ResourceItemRef(RESOURCE_ID, 7), DriverChanges(phone="+573009999999")
        )

        assert [svc for svc, _ in client.calls] == ["core/search_item", "resource/update_driver"]
        params = client.params_of("resource/update_driver")[0]
        assert params["callMode"] == "update"
        assert params["p"] == "+573009999999"
        assert params["jp"] == {"cedula": "1020304050"}
        assert params["pwd"] == "app-pass"
        assert params["f"] == 4
        assert driver is not None and driver.phone == "+573009999999"

    async def test_unknown_driver_is_not_written(self):
        client = FakeWialonClient({"core/search_item": search_item(resource(RESOURCE_ID))})

        result = await WialonDriverGateway(client).update_driver(ResourceItemRef(RESOURCE_ID, 7), DriverChanges(name="X"))

        assert result is None
        assert client.params_of("resource/update_driver") == []


class TestDeleteDriver:
    async def test_deletes_an_existing_driver(self):
        client = FakeWialonClient(
            {"core/search_item": search_item(resource(RESOURCE_ID, LUIS)), "resource/update_driver": [1, None]}
        )

        assert await WialonDriverGateway(client).delete_driver(ResourceItemRef(RESOURCE_ID, 1)) is True
        assert client.params_of("resource/update_driver") == [
            {"itemId": RESOURCE_ID, "id": 1, "callMode": "delete"}
        ]

    async def test_unknown_driver_is_reported_and_nothing_is_deleted(self):
        client = FakeWialonClient({"core/search_item": search_item(resource(RESOURCE_ID))})

        assert await WialonDriverGateway(client).delete_driver(ResourceItemRef(RESOURCE_ID, 1)) is False
        assert client.params_of("resource/update_driver") == []


class TestBinding:
    async def test_bind_sends_mode_1(self):
        client = FakeWialonClient({"resource/bind_unit_driver": {}})
        await WialonDriverGateway(client).bind_to_vehicle(ResourceItemRef(RESOURCE_ID, 7), 600123)

        assert client.params_of("resource/bind_unit_driver") == [
            {"resourceId": RESOURCE_ID, "unitId": 600123, "driverId": 7, "time": 0, "mode": 1}
        ]

    async def test_unbind_sends_mode_0(self):
        client = FakeWialonClient({"resource/bind_unit_driver": {}})
        await WialonDriverGateway(client).unbind_from_vehicle(ResourceItemRef(RESOURCE_ID, 7), 600123)

        assert client.params_of("resource/bind_unit_driver")[0]["mode"] == 0


class TestDuplicates:
    """Wialon answers 1002 when a unique property (checked live: the phone) is already in use."""

    async def test_create_with_a_taken_phone_is_a_409_conflict(self):
        client = FakeWialonClient({"resource/update_driver": wialon_error(1002)})

        with pytest.raises(BusinessRuleError) as raised:
            await WialonDriverGateway(client, default_resource_id=RESOURCE_ID).create_driver(
                DriverChanges(name="Marta", phone="+573001112233")
            )

        assert raised.value.status_code == 409

    async def test_update_with_a_taken_phone_is_a_409_conflict(self):
        client = FakeWialonClient(
            {
                "core/search_item": search_item(resource(RESOURCE_ID, ANA)),
                "resource/update_driver": wialon_error(1002),
            }
        )

        with pytest.raises(BusinessRuleError) as raised:
            await WialonDriverGateway(client).update_driver(
                ResourceItemRef(RESOURCE_ID, 7), DriverChanges(phone="+573001112233")
            )

        assert raised.value.status_code == 409
