from typing import Any

from app.core.exceptions import BusinessRuleError
from app.domain.resource_item_ref import ResourceItemRef
from app.integrations.wialon.client import WialonClient
from app.integrations.wialon.driver_mappers import build_driver_params, map_driver
from app.integrations.wialon.exceptions import WialonError
from app.integrations.wialon.resources import (
    BASE_DATA_FLAG,
    DUPLICATE_CODE,
    find_resource_item,
    resource_for_new_items,
    search_resources,
)
from app.schemas.driver import Driver, DriverChanges

DRIVERS_FLAG = 256
RESOURCE_FLAGS = BASE_DATA_FLAG | DRIVERS_FLAG


class WialonDriverGateway:
    """Reads and writes drivers in Wialon and returns them as our own Driver model.

    Drivers live inside resources. New drivers go to `default_resource_id` when it is set,
    otherwise to the first resource the token can see.
    """

    def __init__(self, client: WialonClient, *, default_resource_id: int | None = None):
        self._client = client
        self._default_resource_id = default_resource_id

    async def list_drivers(self) -> list[Driver]:
        drivers: list[Driver] = []
        for resource in await search_resources(self._client, RESOURCE_FLAGS):
            for raw in (resource.get("drvrs") or {}).values():
                drivers.append(map_driver(resource["id"], raw))
        return drivers

    async def get_driver(self, ref: ResourceItemRef) -> Driver | None:
        raw = await self._raw_driver(ref)
        return map_driver(ref.resource_id, raw) if raw else None

    async def create_driver(self, changes: DriverChanges) -> Driver:
        resource_id = await resource_for_new_items(self._client, self._default_resource_id)
        params = build_driver_params(ResourceItemRef(resource_id, 0), None, changes)
        created = await self._write_driver(params)
        return map_driver(resource_id, created[1])

    async def update_driver(self, ref: ResourceItemRef, changes: DriverChanges) -> Driver | None:
        # Read first: update_driver replaces the whole driver, so we send it back complete.
        current = await self._raw_driver(ref)
        if current is None:
            return None
        params = build_driver_params(ref, current, changes)
        updated = await self._write_driver(params)
        return map_driver(ref.resource_id, updated[1])

    async def delete_driver(self, ref: ResourceItemRef) -> bool:
        if await self._raw_driver(ref) is None:
            return False
        await self._client.call(
            "resource/update_driver",
            {"itemId": ref.resource_id, "id": ref.item_id, "callMode": "delete"},
        )
        return True

    async def bind_to_vehicle(self, ref: ResourceItemRef, vehicle_id: int) -> None:
        await self._bind(ref, vehicle_id, bind=True)

    async def unbind_from_vehicle(self, ref: ResourceItemRef, vehicle_id: int) -> None:
        await self._bind(ref, vehicle_id, bind=False)

    async def _write_driver(self, params: dict[str, Any]) -> Any:
        try:
            return await self._client.call("resource/update_driver", params)
        except WialonError as exc:
            # Wialon keeps some driver properties unique (checked live: the phone number).
            if exc.code == DUPLICATE_CODE:
                raise BusinessRuleError(
                    "Ya existe otro conductor con el mismo teléfono o código.",
                    status_code=409,
                    title="Conductor duplicado",
                ) from exc
            raise

    async def _bind(self, ref: ResourceItemRef, vehicle_id: int, *, bind: bool) -> None:
        await self._client.call(
            "resource/bind_unit_driver",
            {
                "resourceId": ref.resource_id,
                "unitId": vehicle_id,
                "driverId": ref.item_id,
                "time": 0,  # 0 = now
                "mode": 1 if bind else 0,
            },
        )

    async def _raw_driver(self, ref: ResourceItemRef) -> dict[str, Any] | None:
        return await find_resource_item(self._client, ref, flags=RESOURCE_FLAGS, block="drvrs")
