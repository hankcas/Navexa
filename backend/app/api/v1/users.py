from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, status

from app.api.dependencies import DbSession, require_permission
from app.db.models import User
from app.domain.permissions import PermissionCode
from app.repositories.role_repository import RoleRepository
from app.schemas.pagination import Page
from app.schemas.user import (
    RoleOut,
    UserCreate,
    UserOut,
    UserUpdate,
    UserWithTemporaryPassword,
)
from app.services.user_service import UserService

router = APIRouter(tags=["users"])

UserManager = Annotated[User, Depends(require_permission(PermissionCode.USERS_MANAGE))]


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


@router.get("/roles", response_model=list[RoleOut])
async def list_roles(_: UserManager, db: DbSession) -> list[RoleOut]:
    roles = await RoleRepository(db).list_all()
    return [
        RoleOut(name=r.name, permissions=sorted(p.code for p in r.permissions))
        for r in roles
    ]


@router.get("/users", response_model=Page[UserOut])
async def list_users(
    _: UserManager,
    db: DbSession,
    search: Annotated[str | None, Query(max_length=100)] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> Page[UserOut]:
    return await UserService(db).list_users(search=search, page=page, page_size=page_size)


@router.post(
    "/users",
    response_model=UserWithTemporaryPassword,
    status_code=status.HTTP_201_CREATED,
)
async def create_user(
    body: UserCreate, actor: UserManager, request: Request, db: DbSession
) -> UserWithTemporaryPassword:
    return await UserService(db).create_user(actor, body, _client_ip(request))


@router.patch("/users/{user_id}", response_model=UserOut)
async def update_user(
    user_id: int, body: UserUpdate, actor: UserManager, request: Request, db: DbSession
) -> UserOut:
    return await UserService(db).update_user(actor, user_id, body, _client_ip(request))


@router.post("/users/{user_id}/reset-password", response_model=UserWithTemporaryPassword)
async def reset_password(
    user_id: int, actor: UserManager, request: Request, db: DbSession
) -> UserWithTemporaryPassword:
    return await UserService(db).reset_password(actor, user_id, _client_ip(request))