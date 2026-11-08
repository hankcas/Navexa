from datetime import datetime, timezone

from app.domain.resource_item_ref import ResourceItemRef
from app.integrations.wialon.passenger_mappers import build_tag_params, map_passenger
from app.schemas.passenger import PassengerChanges

RESOURCE_ID = 27668776

# Shape taken from a real tag of the demo account, with invented values.
WIALON_TAG = {
    "id": 12,
    "n": "Laura Ríos",
    "c": "P-0012",
    "jp": {"documento": "1020304050", "ruta": "Norte"},
    "r": 1,
    "ck": 4321,
    "f": 1,
    "bu": 600123,
    "pu": 0,
    "bt": 1_762_529_400,
    "tz": -18000,
    "art": 36000,
    "pos": {"y": 0, "x": 0},
}


class TestMapPassenger:
    def test_translates_wialon_fields_to_our_model(self):
        passenger = map_passenger(RESOURCE_ID, WIALON_TAG)

        assert passenger.id == "27668776-12"
        assert passenger.name == "Laura Ríos"
        assert passenger.code == "P-0012"
        assert passenger.custom_fields == {"documento": "1020304050", "ruta": "Norte"}
        assert passenger.vehicle_id == 600123
        assert passenger.bound_at == datetime(2025, 11, 7, 15, 30, tzinfo=timezone.utc)

    def test_does_not_expose_internal_fields(self):
        exposed = map_passenger(RESOURCE_ID, WIALON_TAG).model_dump()
        assert not {"ck", "r", "tz", "f", "art", "pos"} & exposed.keys()

    def test_missing_or_blank_values_do_not_break_it(self):
        passenger = map_passenger(RESOURCE_ID, {"id": 3, "n": " ", "c": "", "jp": None, "bu": 0})

        assert passenger.name == "Pasajero 3"
        assert passenger.code is None
        assert passenger.custom_fields == {}
        assert passenger.vehicle_id is None
        assert passenger.bound_at is None


class TestBuildTagParams:
    ref = ResourceItemRef(RESOURCE_ID, 12)

    def test_update_keeps_every_field_the_user_did_not_change(self):
        params = build_tag_params(self.ref, WIALON_TAG, PassengerChanges(name="Laura R."))

        assert params["callMode"] == "update"
        assert params["n"] == "Laura R."
        assert params["c"] == "P-0012"
        assert params["jp"] == {"documento": "1020304050", "ruta": "Norte"}
        assert (params["ck"], params["r"], params["tz"]) == (4321, 1, -18000)

    def test_custom_fields_are_replaced_as_a_whole(self):
        params = build_tag_params(self.ref, WIALON_TAG, PassengerChanges(custom_fields={"ruta": "Sur"}))
        assert params["jp"] == {"ruta": "Sur"}

    def test_create_fills_every_field_with_safe_defaults(self):
        params = build_tag_params(ResourceItemRef(RESOURCE_ID, 0), None, PassengerChanges(name="Pedro"))

        assert params == {
            "itemId": RESOURCE_ID,
            "id": 0,
            "callMode": "create",
            "n": "Pedro",
            "c": "",
            "jp": {},
            "p": "",
            "ck": 0,
            "r": 0,
            "tz": 0,
        }
