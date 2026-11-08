from typing import Any

from app.core.exceptions import BusinessRuleError
from app.domain.resource_item_ref import ResourceItemRef
from app.integrations.wialon.client import WialonClient
from app.integrations.wialon.exceptions import WialonError
from app.integrations.wialon.passenger_mappers import build_tag_params, map_passenger
from app.integrations.wialon.resources import (
    BASE_DATA_FLAG,
    DUPLICATE_CODE,
    find_resource_item,
    resource_for_new_items,
    search_resources,
)
from app.schemas.passenger import Passenger, PassengerChanges

TAGS_FLAG = 2_097_152  # 0x00200000
RESOURCE_FLAGS = BASE_DATA_FLAG | TAGS_FLAG


class WialonPassengerGateway:
    """Reads and writes passengers in Wialon, where they are "tags" inside a resource.

    New passengers go to `default_resource_id` when it is set, otherwise to the first
    resource the token can see.
    """

    def __init__(self, client: WialonClient, *, default_resource_id: int | None = None):
        self._client = client
        self._default_resource_id = default_resource_id

    async def list_passengers(self) -> list[Passenger]:
        passengers: list[Passenger] = []
        for resource in await search_resources(self._client, RESOURCE_FLAGS):
            for raw in (resource.get("tags") or {}).values():
                passengers.append(map_passenger(resource["id"], raw))
        return passengers

    async def get_passenger(self, ref: ResourceItemRef) -> Passenger | None:
        raw = await self._raw_tag(ref)
        return map_passenger(ref.resource_id, raw) if raw else None

    async def create_passenger(self, changes: PassengerChanges) -> Passenger:
        resource_id = await resource_for_new_items(self._client, self._default_resource_id)
        params = build_tag_params(ResourceItemRef(resource_id, 0), None, changes)
        created = await self._write_tag(params)
        return map_passenger(resource_id, created[1])

    async def update_passenger(
        self, ref: ResourceItemRef, changes: PassengerChanges
    ) -> Passenger | None:
        # Read first: update_tag rejects partial data, so we send the tag back complete.
        current = await self._raw_tag(ref)
        if current is None:
            return None
        params = build_tag_params(ref, current, changes)
        updated = await self._write_tag(params)
        return map_passenger(ref.resource_id, updated[1])

    async def delete_passenger(self, ref: ResourceItemRef) -> bool:
        if await self._raw_tag(ref) is None:
            return False
        await self._client.call(
            "resource/update_tag",
            {"itemId": ref.resource_id, "id": ref.item_id, "callMode": "delete"},
        )
        return True

    async def bind_to_vehicle(self, ref: ResourceItemRef, vehicle_id: int) -> None:
        await self._bind(ref, vehicle_id, bind=True)

    async def unbind_from_vehicle(self, ref: ResourceItemRef, vehicle_id: int) -> None:
        await self._bind(ref, vehicle_id, bind=False)

    async def _write_tag(self, params: dict[str, Any]) -> Any:
        try:
            return await self._client.call("resource/update_tag", params)
        except WialonError as exc:
            if exc.code == DUPLICATE_CODE:
                raise BusinessRuleError(
                    "Ya existe otro pasajero con el mismo código.",
                    status_code=409,
                    title="Pasajero duplicado",
                ) from exc
            raise

    async def _bind(self, ref: ResourceItemRef, vehicle_id: int, *, bind: bool) -> None:
        # Wialon stores bindings per second (checked live): an unbind in the same second as
        # the bind is ignored. Moving a passenger to another vehicle in one second does work.
        await self._client.call(
            "resource/bind_unit_tag",
            {
                "resourceId": ref.resource_id,
                "unitId": vehicle_id,
                "tagId": ref.item_id,
                "time": 0,  # 0 = now
                "mode": 1 if bind else 0,
            },
        )

    async def _raw_tag(self, ref: ResourceItemRef) -> dict[str, Any] | None:
        return await find_resource_item(self._client, ref, flags=RESOURCE_FLAGS, block="tags")
