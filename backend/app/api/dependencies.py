from collections.abc import AsyncIterator
from datetime import timedelta
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import AuthenticationError, PermissionDeniedError
from app.core.security import ACCESS, decode_token
from app.db.models import User
from app.db.session import SessionLocal
from app.domain.permissions import PermissionCode
from app.integrations.wialon.drivers_gateway import WialonDriverGateway
from app.integrations.wialon.passengers_gateway import WialonPassengerGateway
from app.integrations.wialon.units_gateway import WialonUnitGateway
from app.repositories.user_repository import UserRepository
from app.services.dashboard_service import DashboardService
from app.services.driver_service import DriverService
from app.services.passenger_service import PassengerService
from app.services.vehicle_fields_service import VehicleFieldsService
from app.services.vehicle_service import VehicleService

ACCESS_COOKIE = "access_token"
REFRESH_COOKIE = "refresh_token"


async def get_db() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session


DbSession = Annotated[AsyncSession, Depends(get_db)]


async def get_current_user(request: Request, db: DbSession) -> User:
    token = request.cookies.get(ACCESS_COOKIE)
    payload = decode_token(token, ACCESS) if token else None
    if payload is None:
        raise AuthenticationError("Missing or invalid access token")

    user = await UserRepository(db).get_by_id(int(payload["sub"]))
    if user is None or not user.is_active or user.token_version != payload["ver"]:
        raise AuthenticationError("Session is no longer valid")
    return user


CurrentUserDep = Annotated[User, Depends(get_current_user)]


def require_permission(permission: PermissionCode):
    async def checker(user: CurrentUserDep) -> User:
        if user.must_change_password:
            raise PermissionDeniedError(f"user={user.id} must change password first")
        if permission.value not in {p.code for p in user.role.permissions}:
            raise PermissionDeniedError(f"user={user.id} lacks {permission.value}")
        return user

    return checker


def _unit_gateway(request: Request) -> WialonUnitGateway:
    return WialonUnitGateway(
        request.app.state.wialon_client,
        moving_speed_kmh=settings.status_moving_speed_kmh,
        offline_after=timedelta(minutes=settings.status_offline_minutes),
    )


def _driver_gateway(request: Request) -> WialonDriverGateway:
    return WialonDriverGateway(
        request.app.state.wialon_client,
        default_resource_id=settings.wialon_resource_id,
    )


def _passenger_gateway(request: Request) -> WialonPassengerGateway:
    return WialonPassengerGateway(
        request.app.state.wialon_client,
        default_resource_id=settings.wialon_resource_id,
    )


def get_vehicle_service(request: Request) -> VehicleService:
    return VehicleService(
        _unit_gateway(request), _driver_gateway(request), _passenger_gateway(request)
    )


def get_vehicle_fields_service(request: Request, db: DbSession) -> VehicleFieldsService:
    return VehicleFieldsService(_unit_gateway(request), db)


def get_driver_service(request: Request, db: DbSession) -> DriverService:
    """Dependency injection: the service receives its gateways, so tests can pass fakes."""
    return DriverService(_driver_gateway(request), _unit_gateway(request), db)


def get_passenger_service(request: Request, db: DbSession) -> PassengerService:
    return PassengerService(_passenger_gateway(request), _unit_gateway(request), db)


def get_dashboard_service(request: Request) -> DashboardService:
    return DashboardService(
        _unit_gateway(request), _driver_gateway(request), _passenger_gateway(request)
    )
