import asyncio

from app.core.config import settings
from app.integrations.wialon.client import WialonClient


async def main() -> None:
    client = WialonClient(settings.wialon_base_url, settings.wialon_token)
    try:
        result = await client.call(
            "core/search_items",
            {
                "spec": {
                    "itemsType": "avl_unit",
                    "propName": "sys_name",
                    "propValueMask": "*",
                    "sortType": "sys_name",
                },
                "force": 1,
                "flags": 1,
                "from": 0,
                "to": 0,
            },
        )
        units = result.get("items", [])
        print(f"Units found: {len(units)}")
        for unit in units[:5]:
            print(f"- {unit['id']}: {unit['nm']}")
    finally:
        await client.close()


if __name__ == "__main__":
    asyncio.run(main())