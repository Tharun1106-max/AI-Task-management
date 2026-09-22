"""Pydantic request and response schemas for user authentication and profile."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.user import UserRole


# ==============================================================================
# Authentication Schemas
# ==============================================================================

class UserRegister(BaseModel):
    """Payload schema for user registration."""

    email: EmailStr = Field(..., description="Valid work or personal email address")
    password: str = Field(
        ...,
        min_length=8,
        max_length=128,
        description="Password (minimum 8 characters)",
    )
    full_name: str = Field(
        ...,
        min_length=2,
        max_length=100,
        description="Display name or full name",
    )
    role: Optional[UserRole] = Field(
        default=UserRole.MEMBER,
        description="Assigned role (MEMBER by default, or OWNER for team creator)",
    )


class UserLogin(BaseModel):
    """Payload schema for user credential login."""

    email: EmailStr = Field(..., description="Registered email address")
    password: str = Field(..., description="Plaintext secret password")


# ==============================================================================
# User Profile Schemas
# ==============================================================================

class UserResponse(BaseModel):
    """Sanitized public user profile response (omits password hash)."""

    model_config = ConfigDict(from_attributes=True)

    id: str = Field(..., description="Unique user identifier")
    email: EmailStr = Field(..., description="User email address")
    full_name: str = Field(..., description="User's full name")
    role: UserRole = Field(..., description="Assigned authorization role")
    avatar_url: Optional[str] = Field(default=None, description="Profile picture URL")
    created_at: datetime = Field(..., description="Account creation timestamp")
    updated_at: datetime = Field(..., description="Account modification timestamp")


class UserUpdate(BaseModel):
    """Payload schema for updating user profile attributes."""

    full_name: Optional[str] = Field(
        default=None,
        min_length=2,
        max_length=100,
        description="Updated full name",
    )
    avatar_url: Optional[str] = Field(
        default=None,
        max_length=500,
        description="Updated profile avatar image URL",
    )


class PasswordChange(BaseModel):
    """Payload schema for updating user password."""

    current_password: str = Field(..., description="Existing plaintext password for verification")
    new_password: str = Field(
        ...,
        min_length=8,
        max_length=128,
        description="New password (minimum 8 characters)",
    )


# ==============================================================================
# Token Schemas
# ==============================================================================

class TokenResponse(BaseModel):
    """Authentication token response containing bearer credentials and profile."""

    access_token: str = Field(..., description="JWT access token")
    refresh_token: str = Field(..., description="JWT refresh token")
    token_type: str = Field(default="bearer", description="Token scheme type")
    expires_in: int = Field(..., description="Access token expiration window in seconds")
    user: UserResponse = Field(..., description="Authenticated user profile")


class TokenData(BaseModel):
    """Internal decoded JWT claims schema."""

    sub: str = Field(..., description="Subject claim (User ID)")
    email: EmailStr = Field(..., description="User email claim")
    role: UserRole = Field(..., description="User authorization role claim")
    token_type: str = Field(default="access", description="access or refresh")
