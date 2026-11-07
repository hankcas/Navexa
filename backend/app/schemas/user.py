from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.domain.permissions import RoleName


class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    role: RoleName
    is_active: bool
    must_change_password: bool
    is_locked: bool
    created_at: datetime


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=120)
    role: RoleName


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=120)
    role: RoleName | None = None
    is_active: bool | None = None


class UserWithTemporaryPassword(BaseModel):
    user: UserOut
    temporary_password: str


class RoleOut(BaseModel):
    name: RoleName
    permissions: list[str]