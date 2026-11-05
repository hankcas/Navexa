from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.v1.vehicles import router as vehicles_router
from app.core.config import settings
from app.integrations.wialon.client import WialonClient


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.wialon_client = WialonClient(
        settings.wialon_base_url, settings.wialon_token
    )
    yield
    await app.state.wialon_client.close()


app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)
app.include_router(vehicles_router, prefix="/api/v1")


@app.get("/health")
def health():
    return {"status": "ok", "environment": settings.environment}