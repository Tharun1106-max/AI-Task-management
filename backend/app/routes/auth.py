"""Authentication Router for TaskPilot.

Handles user registration, login credential verification,
JWT token generation, and logout operations.
"""

from datetime import datetime, timezone
import logging
from typing import Any, Dict
from bson import ObjectId
from fastapi import APIRouter, HTTPException, status

from app.config import get_settings
from app.database.mongodb import get_collection
from app.models.user import UserInDB, UserRole
from app.schemas.user import TokenResponse, UserLogin, UserRegister, UserResponse
from app.utils.security import create_access_token, create_refresh_token, hash_password, verify_password

logger = logging.getLogger("taskpilot.auth")
router = APIRouter(prefix="", tags=["Authentication"])
settings = get_settings()


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register New User Account",
    description="Creates a new user profile with hashed password and generates initial JWT tokens.",
)
async def register(payload: UserRegister) -> TokenResponse:
    """Register a new user, prevent duplicates, and return authentication tokens."""
    users_col = get_collection("users")

    # 1. Check for existing email address
    normalized_email = payload.email.strip().lower()
    existing_user = await users_col.find_one({"email": normalized_email})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists.",
        )

    # 2. Hash password securely
    hashed_pwd = hash_password(payload.password)

    # 3. Create MongoDB document
    now = datetime.now(timezone.utc)
    role_val = getattr(payload.role, "value", payload.role) if payload.role else UserRole.MEMBER.value
    new_user_dict: Dict[str, Any] = {
        "email": normalized_email,
        "hashed_password": hashed_pwd,
        "full_name": payload.full_name.strip(),
        "role": str(role_val),
        "avatar_url": None,
        "created_at": now,
        "updated_at": now,
    }

    insert_result = await users_col.insert_one(new_user_dict)
    user_id = str(insert_result.inserted_id)
    new_user_dict["_id"] = insert_result.inserted_id

    user_in_db = UserInDB.from_mongo(new_user_dict)
    user_response = UserResponse(
        id=user_id,
        email=user_in_db.email,
        full_name=user_in_db.full_name,
        role=user_in_db.role,
        avatar_url=user_in_db.avatar_url,
        created_at=user_in_db.created_at,
        updated_at=user_in_db.updated_at,
    )

    # 4. Generate JWT tokens
    user_role_str = getattr(user_in_db.role, "value", user_in_db.role)
    token_claims = {
        "sub": user_id,
        "email": user_in_db.email,
        "role": str(user_role_str),
    }
    access_token = create_access_token(token_claims)
    refresh_token = create_refresh_token(token_claims)

    logger.info("User registered successfully: %s (role: %s)", normalized_email, user_in_db.role)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=user_response,
    )


@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Authenticate User",
    description="Verifies user credentials and returns new JWT access and refresh tokens.",
)
async def login(payload: UserLogin) -> TokenResponse:
    """Validate credentials and return JWT bearer tokens."""
    users_col = get_collection("users")
    normalized_email = payload.email.strip().lower()

    user_doc = await users_col.find_one({"email": normalized_email})
    if not user_doc or not verify_password(payload.password, user_doc.get("hashed_password", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_in_db = UserInDB.from_mongo(user_doc)
    user_id = user_in_db.id

    user_role_str = getattr(user_in_db.role, "value", user_in_db.role)
    token_claims = {
        "sub": user_id,
        "email": user_in_db.email,
        "role": str(user_role_str),
    }
    access_token = create_access_token(token_claims)
    refresh_token = create_refresh_token(token_claims)

    user_response = UserResponse(
        id=user_id,
        email=user_in_db.email,
        full_name=user_in_db.full_name,
        role=user_in_db.role,
        avatar_url=user_in_db.avatar_url,
        created_at=user_in_db.created_at,
        updated_at=user_in_db.updated_at,
    )

    logger.info("User logged in successfully: %s", normalized_email)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=user_response,
    )


@router.post(
    "/logout",
    status_code=status.HTTP_200_OK,
    summary="Logout User",
    description="Stateless token invalidation endpoint confirming client-side token discard.",
)
async def logout() -> Dict[str, Any]:
    """Handles logout in a stateless JWT architecture."""
    return {
        "success": True,
        "message": "Successfully logged out. Please discard your local authentication tokens.",
    }
