from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.v1.auth import router as auth_router
from app.api.v1.users import router as users_router
from app.api.v1.vehicles import router as vehicles_router
from app.core.config import settings
from app.core.errors import register_exception_handlers
from app.integrations.wialon.client import WialonClient


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.wialon_client = WialonClient(
        settings.wialon_base_url, settings.wialon_token
    )
    yield
    await app.state.wialon_client.close()


app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)
register_exception_handlers(app)
app.include_router(auth_router, prefix="/api/v1")
app.include_router(vehicles_router, prefix="/api/v1")
app.include_router(users_router, prefix="/api/v1")


@app.get("/health")
def health():
    return {"status": "ok", "environment": settings.environment}