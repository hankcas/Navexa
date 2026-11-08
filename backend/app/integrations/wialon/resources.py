"""Helpers for items that live inside Wialon resources (drivers and passengers/tags)."""
from typing import Any

from app.domain.resource_item_ref import ResourceItemRef
from app.integrations.wialon.client import WialonClient
from app.integrations.wialon.exceptions import WialonError

BASE_DATA_FLAG = 1

# Wialon answers these codes when an item does not exist or the token cannot see it.
NOT_FOUND_CODES = {4, 6, 7}
# "Item with such unique property already exists".
DUPLICATE_CODE = 1002


async def search_resources(client: WialonClient, flags: int) -> list[dict[str, Any]]:
    """Every resource the token can see, with the data blocks selected by `flags`."""
    result = await client.call(
        "core/search_items",
        {
            "spec": {
                "itemsType": "avl_resource",
                "propName": "sys_name",
                "propValueMask": "*",
                "sortType": "sys_name",
            },
            "force": 1,
            "flags": flags,
            "from": 0,
            "to": 0,
        },
    )
    return result.get("items", [])


async def find_resource_item(
    client: WialonClient, ref: ResourceItemRef, *, flags: int, block: str
) -> dict[str, Any] | None:
    """One item exactly as Wialon stores it, or None if it or its resource does not exist.

    `block` is the resource property that holds the items: "drvrs" or "tags".
    """
    try:
        result = await client.call("core/search_item", {"id": ref.resource_id, "flags": flags})
    except WialonError as exc:
        if exc.code in NOT_FOUND_CODES:
            return None
        raise
    items = (result.get("item") or {}).get(block) or {}
    return next((item for item in items.values() if item.get("id") == ref.item_id), None)


async def resource_for_new_items(client: WialonClient, default_resource_id: int | None) -> int:
    """The configured resource, or the first one the token can see."""
    if default_resource_id is not None:
        return default_resource_id
    resources = await search_resources(client, BASE_DATA_FLAG)
    if not resources:
        raise WialonError("The Wialon token cannot see any resource to store items")
    return resources[0]["id"]
