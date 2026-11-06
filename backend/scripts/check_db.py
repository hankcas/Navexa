import asyncio

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.config import settings


async def main() -> None:
    engine = create_async_engine(settings.database_url)
    async with engine.connect() as conn:
        version = await conn.scalar(text("select version()"))
        print("Connected to:", version)
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())