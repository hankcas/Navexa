import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from app.integrations.wialon.client import WialonClient
from app.integrations.wialon.exceptions import WialonError
from app.integrations.wialon.mappers import map_message_to_track_point, map_unit_to_vehicle
from app.integrations.wialon.resources import NOT_FOUND_CODES
from app.schemas.track import TrackPoint
from app.schemas.vehicle import CustomField, Vehicle

logger = logging.getLogger(__name__)

BASE_DATA_FLAG = 1
CUSTOM_FIELDS_FLAG = 8
LAST_POSITION_FLAG = 1024
UNIT_FLAGS = BASE_DATA_FLAG | LAST_POSITION_FLAG
UNIT_DETAIL_FLAGS = UNIT_FLAGS | CUSTOM_FIELDS_FLAG

# Message filter: the high byte is the message type (0x00 = data message) and bit 0x01 says
# "has a position". Masking both keeps only data messages that carry a position.
MESSAGES_WITH_POSITION = 0x0001
MESSAGE_TYPE_AND_POSITION_MASK = 0xFF01


def map_custom_field(raw: dict[str, Any]) -> CustomField:
    modified = raw.get("mt")
    return CustomField(
        id=raw["id"],
        name=str(raw.get("n") or ""),
        value=str(raw.get("v") or ""),
        modified_at=(
            datetime.fromtimestamp(modified, tz=timezone.utc)
            if isinstance(modified, (int, float)) and modified > 0
            else None
        ),
    )


class WialonUnitGateway:
    """Reads units from Wialon as our own Vehicle model, and edits their custom fields."""

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
        return [self._map(raw_unit) for raw_unit in result.get("items", [])]

    async def get_vehicle(self, vehicle_id: int) -> tuple[Vehicle, list[CustomField]] | None:
        """One vehicle with its custom fields, or None if it does not exist or is not visible."""
        raw = await self._raw_unit(vehicle_id)
        if raw is None:
            return None
        fields = [map_custom_field(f) for f in (raw.get("flds") or {}).values()]
        return self._map(raw), sorted(fields, key=lambda field: field.name.lower())

    async def create_custom_field(self, vehicle_id: int, name: str, value: str) -> CustomField:
        result = await self._client.call(
            "item/update_custom_field",
            {"itemId": vehicle_id, "id": 0, "callMode": "create", "n": name, "v": value},
        )
        return map_custom_field(result[1])

    async def update_custom_field(
        self, vehicle_id: int, field_id: int, name: str, value: str
    ) -> CustomField:
        # Wialon needs name and value together on update (checked live: error 4 otherwise).
        result = await self._client.call(
            "item/update_custom_field",
            {"itemId": vehicle_id, "id": field_id, "callMode": "update", "n": name, "v": value},
        )
        return map_custom_field(result[1])

    async def delete_custom_field(self, vehicle_id: int, field_id: int) -> None:
        await self._client.call(
            "item/update_custom_field",
            {"itemId": vehicle_id, "id": field_id, "callMode": "delete"},
        )

    async def load_track(
        self, vehicle_id: int, start: datetime, end: datetime, *, max_messages: int
    ) -> tuple[list[TrackPoint], int] | None:
        """Positions between two dates, oldest first, and how many messages Wialon has there.

        `messages/load_interval` loads the messages into the session and returns at most
        `max_messages` of them; `count` says how many there really are, so the caller can tell
        when the range was too big. `messages/unload` frees them afterwards.
        None if the vehicle does not exist or the token cannot see it.
        """
        async with self._client.messages_lock:
            try:
                result = await self._client.call(
                    "messages/load_interval",
                    {
                        "itemId": vehicle_id,
                        "timeFrom": int(start.timestamp()),
                        "timeTo": int(end.timestamp()),
                        "flags": MESSAGES_WITH_POSITION,
                        "flagsMask": MESSAGE_TYPE_AND_POSITION_MASK,
                        "loadCount": max_messages,
                    },
                )
            except WialonError as exc:
                if exc.code in NOT_FOUND_CODES:
                    return None
                raise
            finally:
                await self._unload_messages()

        points = [
            point
            for point in map(map_message_to_track_point, result.get("messages") or [])
            if point is not None
        ]
        points.sort(key=lambda point: point.time)
        return points, int(result.get("count") or 0)

    async def _unload_messages(self) -> None:
        try:
            await self._client.call("messages/unload", {})
        except WialonError:
            # Not freeing them only costs memory in Wialon; the next load replaces them anyway.
            logger.warning("Could not unload Wialon messages", exc_info=True)

    async def _raw_unit(self, vehicle_id: int) -> dict[str, Any] | None:
        try:
            result = await self._client.call(
                "core/search_item", {"id": vehicle_id, "flags": UNIT_DETAIL_FLAGS}
            )
        except WialonError as exc:
            if exc.code in NOT_FOUND_CODES:
                return None
            raise
        return result.get("item")

    def _map(self, raw_unit: dict[str, Any]) -> Vehicle:
        return map_unit_to_vehicle(
            raw_unit,
            moving_speed_kmh=self._moving_speed_kmh,
            offline_after=self._offline_after,
        )
