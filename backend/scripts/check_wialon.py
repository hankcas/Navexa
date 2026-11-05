import asyncio
import json

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
                "flags": 1025,
                "from": 0,
                "to": 0,
            },
        )
        units = result.get("items", [])
        print(f"Units found: {len(units)}")
        with_position = next((u for u in units if u.get("pos")), None)
        print(json.dumps(with_position, indent=2))
    finally:
        await client.close()


if __name__ == "__main__":
    asyncio.run(main())