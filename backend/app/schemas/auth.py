from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class CurrentUser(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    permissions: list[str]
    must_change_password: bool