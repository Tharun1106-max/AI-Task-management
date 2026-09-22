"""User Profile and Account Management Routes for TaskPilot."""

from datetime import datetime, timezone
import logging
from typing import Any, Dict
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from app.database.mongodb import get_collection
from app.models.user import UserInDB
from app.schemas.user import PasswordChange, UserResponse, UserUpdate
from app.utils.security import get_current_user, hash_password, verify_password

logger = logging.getLogger("taskpilot.users")
router = APIRouter(prefix="", tags=["Users"])


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get Current User Profile",
    description="Fetches the authenticated user profile using the provided Bearer token.",
)
async def get_current_user_profile(
    current_user: UserInDB = Depends(get_current_user),
) -> UserResponse:
    """Retrieve currently authenticated user profile."""
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role,
        avatar_url=current_user.avatar_url,
        created_at=current_user.created_at,
        updated_at=current_user.updated_at,
    )


@router.put(
    "/me",
    response_model=UserResponse,
    summary="Update Current User Profile",
    description="Modifies the authenticated user's name or avatar URL.",
)
async def update_current_user_profile(
    payload: UserUpdate,
    current_user: UserInDB = Depends(get_current_user),
) -> UserResponse:
    """Update profile attributes for current authenticated user."""
    users_col = get_collection("users")
    update_fields: Dict[str, Any] = {}

    if payload.full_name is not None:
        update_fields["full_name"] = payload.full_name.strip()
    if payload.avatar_url is not None:
        update_fields["avatar_url"] = payload.avatar_url.strip() or None

    if not update_fields:
        return UserResponse(
            id=current_user.id,
            email=current_user.email,
            full_name=current_user.full_name,
            role=current_user.role,
            avatar_url=current_user.avatar_url,
            created_at=current_user.created_at,
            updated_at=current_user.updated_at,
        )

    now = datetime.now(timezone.utc)
    update_fields["updated_at"] = now

    query: Dict[str, Any]
    if ObjectId.is_valid(current_user.id):
        query = {"_id": ObjectId(current_user.id)}
    else:
        query = {"email": current_user.email}

    await users_col.update_one(query, {"$set": update_fields})
    updated_doc = await users_col.find_one(query)

    if not updated_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User record not found during profile update.",
        )

    updated_user = UserInDB.from_mongo(updated_doc)
    logger.info("Updated profile for user: %s", current_user.email)

    return UserResponse(
        id=updated_user.id,
        email=updated_user.email,
        full_name=updated_user.full_name,
        role=updated_user.role,
        avatar_url=updated_user.avatar_url,
        created_at=updated_user.created_at,
        updated_at=updated_user.updated_at,
    )


@router.put(
    "/password",
    status_code=status.HTTP_200_OK,
    summary="Change User Password",
    description="Validates the current password and securely updates to the new bcrypt-hashed password.",
)
async def change_password(
    payload: PasswordChange,
    current_user: UserInDB = Depends(get_current_user),
) -> Dict[str, Any]:
    """Verify existing password and set new password."""
    # 1. Verify old password
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password verification failed.",
        )

    # 2. Check if new password is same as old
    if verify_password(payload.new_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from current password.",
        )

    # 3. Hash new password and commit
    new_hashed_pwd = hash_password(payload.new_password)
    users_col = get_collection("users")

    query: Dict[str, Any]
    if ObjectId.is_valid(current_user.id):
        query = {"_id": ObjectId(current_user.id)}
    else:
        query = {"email": current_user.email}

    await users_col.update_one(
        query,
        {
            "$set": {
                "hashed_password": new_hashed_pwd,
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )

    logger.info("Password changed successfully for user: %s", current_user.email)

    return {
        "success": True,
        "message": "Password updated successfully. Please use your new credentials on subsequent logins.",
    }
