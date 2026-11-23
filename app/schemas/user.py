from enum import Enum
from typing import Optional

from pydantic import BaseModel, EmailStr, Field

from app.schemas.types import UtcDateTime


class UserRole(str, Enum):
    admin = "admin"
    user = "user"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class GoogleLoginRequest(BaseModel):
    credential: str


class CreateUser(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    full_name: Optional[str] = None
    role: UserRole = UserRole.user


class UserOut(BaseModel):
    id: int
    email: EmailStr
    full_name: Optional[str] = None
    department: Optional[str] = None
    role: UserRole
    auth_provider: str = "email"
    is_active: bool
    created_at: UtcDateTime

    model_config = {"from_attributes": True}


class LoginResponse(BaseModel):
    """Either a session (`access_token`) or, for admins, a 2FA challenge.

    When `mfa_required` is true there is no access token yet: send `mfa_token`
    plus a code to /auth/mfa/verify (or /auth/mfa/setup + /enable if
    `mfa_setup_required`).
    """

    access_token: Optional[str] = None
    token_type: str = "bearer"
    user: UserOut
    mfa_required: bool = False
    mfa_setup_required: bool = False
    mfa_token: Optional[str] = None


class Token(BaseModel):
    """Standard OAuth2 token response (Swagger Authorize button)."""

    access_token: str
    token_type: str = "bearer"


class UpdateUser(BaseModel):
    full_name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(default=None, min_length=6)
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None


class ChangePassword(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)
