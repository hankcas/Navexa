from datetime import datetime, timezone

from app.domain.driver_ref import DriverRef
from app.integrations.wialon.driver_mappers import build_driver_params, map_driver
from app.schemas.driver import DriverChanges

RESOURCE_ID = 27668776

# Shape taken from a real driver of the demo account, with invented values.
WIALON_DRIVER = {
    "id": 7,
    "n": "Ana Gómez",
    "c": "A-100",
    "p": "+573001234567",
    "ds": "Turno mañana",
    "jp": {"cedula": "1020304050", "Sexo": "F"},
    "ej": {"apps": []},
    "pwd": "secreto-app",
    "f": 4,
    "ck": 1234,
    "r": 1,
    "bu": 600123,
    "pu": 0,
    "bt": 1_762_529_400,
}


class TestMapDriver:
    def test_translates_wialon_fields_to_our_model(self):
        driver = map_driver(RESOURCE_ID, WIALON_DRIVER)

        assert driver.id == "27668776-7"
        assert driver.name == "Ana Gómez"
        assert driver.code == "A-100"
        assert driver.phone == "+573001234567"
        assert driver.description == "Turno mañana"
        assert driver.custom_fields == {"cedula": "1020304050", "Sexo": "F"}
        assert driver.vehicle_id == 600123
        assert driver.bound_at == datetime(2025, 11, 7, 15, 30, tzinfo=timezone.utc)

    def test_never_exposes_password_or_internal_fields(self):
        exposed = map_driver(RESOURCE_ID, WIALON_DRIVER).model_dump()
        assert "secreto-app" not in str(exposed)
        assert not {"pwd", "ej", "f", "ck", "r"} & exposed.keys()

    def test_unbound_driver_has_no_vehicle(self):
        driver = map_driver(RESOURCE_ID, {**WIALON_DRIVER, "bu": 0})
        assert driver.vehicle_id is None
        assert driver.bound_at is None

    def test_missing_or_blank_values_become_none(self):
        driver = map_driver(RESOURCE_ID, {"id": 3, "n": "  ", "c": "", "jp": None})

        assert driver.name == "Conductor 3"
        assert driver.code is None
        assert driver.phone is None
        assert driver.custom_fields == {}
        assert driver.vehicle_id is None


class TestBuildDriverParams:
    ref = DriverRef(RESOURCE_ID, 7)

    def test_update_keeps_every_field_the_user_did_not_change(self):
        params = build_driver_params(self.ref, WIALON_DRIVER, DriverChanges(phone="+573009999999"))

        assert params["callMode"] == "update"
        assert params["p"] == "+573009999999"
        # Everything else goes back exactly as Wialon had it, so nothing is erased.
        assert params["n"] == "Ana Gómez"
        assert params["c"] == "A-100"
        assert params["ds"] == "Turno mañana"
        assert params["jp"] == {"cedula": "1020304050", "Sexo": "F"}
        assert params["pwd"] == "secreto-app"
        assert params["ej"] == {"apps": []}
        assert params["f"] == 4
        assert params["ck"] == 1234
        assert params["r"] == 1

    def test_custom_fields_are_replaced_as_a_whole(self):
        params = build_driver_params(self.ref, WIALON_DRIVER, DriverChanges(custom_fields={"cedula": "99"}))
        assert params["jp"] == {"cedula": "99"}

    def test_an_empty_string_clears_a_value_on_purpose(self):
        params = build_driver_params(self.ref, WIALON_DRIVER, DriverChanges(description=""))
        assert params["ds"] == ""

    def test_create_fills_every_field_with_safe_defaults(self):
        params = build_driver_params(DriverRef(RESOURCE_ID, 0), None, DriverChanges(name="Luis"))

        assert params == {
            "itemId": RESOURCE_ID,
            "id": 0,
            "callMode": "create",
            "n": "Luis",
            "c": "",
            "p": "",
            "ds": "",
            "jp": {},
            "pwd": "",
            "ej": {},
            "f": 0,
            "ck": 0,
            "r": 0,
        }
