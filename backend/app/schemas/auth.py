from pydantic import BaseModel, EmailStr, Field, field_validator

from app.domain.password_policy import MAX_LENGTH, password_policy_errors


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


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=MAX_LENGTH)
    new_password: str = Field(min_length=1, max_length=MAX_LENGTH)

    @field_validator("new_password")
    @classmethod
    def check_policy(cls, value: str) -> str:
        errors = password_policy_errors(value)
        if errors:
            raise ValueError(" ".join(errors))
        return value