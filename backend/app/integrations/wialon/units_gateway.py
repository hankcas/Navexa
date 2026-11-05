from datetime import timedelta

from app.integrations.wialon.client import WialonClient
from app.integrations.wialon.mappers import map_unit_to_vehicle
from app.schemas.vehicle import Vehicle

BASE_DATA_FLAG = 1
LAST_POSITION_FLAG = 1024
UNIT_FLAGS = BASE_DATA_FLAG | LAST_POSITION_FLAG


class WialonUnitGateway:
    """Reads units from Wialon and returns them as our own Vehicle model."""

    def __init__(
        self,
        client: WialonClient,
        *,
        moving_speed_kmh: float,
        offline_after: timedelta,
    ):
        self._client = client
        self._moving_speed_kmh = moving_speed_kmh
        self._offline_after = offline_after

    async def list_vehicles(self) -> list[Vehicle]:
        result = await self._client.call(
            "core/search_items",
            {
                "spec": {
                    "itemsType": "avl_unit",
                    "propName": "sys_name",
                    "propValueMask": "*",
                    "sortType": "sys_name",
                },
                "force": 1,
                "flags": UNIT_FLAGS,
                "from": 0,
                "to": 0,
            },
        )
        return [
            map_unit_to_vehicle(
                raw_unit,
                moving_speed_kmh=self._moving_speed_kmh,
                offline_after=self._offline_after,
            )
            for raw_unit in result.get("items", [])
        ]