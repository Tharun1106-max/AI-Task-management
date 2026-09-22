"""Notifications & Activity Audit API Routes."""

from datetime import datetime, timezone
import logging
from typing import Any, Dict, List, Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, Query, status

from app.database.mongodb import get_collection
from app.models.user import UserInDB
from app.schemas.notification import NotificationListResponse, NotificationResponse
from app.utils.security import get_current_user

logger = logging.getLogger("taskpilot.notifications")
router = APIRouter(prefix="", tags=["Notifications"])


async def log_activity(
    user_id: str,
    user_name: str,
    action: str,
    description: str,
    project_id: Optional[str] = None,
    project_name: Optional[str] = None,
) -> None:
    """Helper to record immutable activity audit logs in MongoDB."""
    try:
        activity_col = get_collection("activity_logs")
        await activity_col.insert_one({
            "user_id": user_id,
            "user_name": user_name,
            "action": action,
            "description": description,
            "project_id": project_id,
            "project_name": project_name,
            "timestamp": datetime.now(timezone.utc),
        })
    except Exception as exc:
        logger.warning("Failed to record activity log: %s", exc)


async def send_notification(
    recipient_id: str,
    title: str,
    message: str,
    notification_type: str,
    link: Optional[str] = None,
) -> None:
    """Helper to create persistent in-app notifications for users."""
    try:
        notifications_col = get_collection("notifications")
        await notifications_col.insert_one({
            "user_id": recipient_id,
            "title": title,
            "message": message,
            "type": notification_type,
            "link": link,
            "is_read": False,
            "created_at": datetime.now(timezone.utc),
        })
    except Exception as exc:
        logger.warning("Failed to deliver notification to %s: %s", recipient_id, exc)


@router.get(
    "",
    response_model=NotificationListResponse,
    summary="Get User Notifications",
    description="Retrieves in-app notifications for authenticated user, unread items sorted first.",
)
async def get_notifications(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    current_user: UserInDB = Depends(get_current_user),
) -> NotificationListResponse:
    """Fetch notifications for current user with unread prioritized."""
    notifications_col = get_collection("notifications")

    query = {"user_id": current_user.id}
    total = await notifications_col.count_documents(query)
    unread_count = await notifications_col.count_documents({"user_id": current_user.id, "is_read": False})

    skip = (page - 1) * limit
    # Sort unread first (is_read: 1 means False comes first in asc order, then created_at desc)
    cursor = (
        notifications_col.find(query)
        .sort([("is_read", 1), ("created_at", -1)])
        .skip(skip)
        .limit(limit)
    )

    items: List[NotificationResponse] = []
    async for doc in cursor:
        items.append(
            NotificationResponse(
                id=str(doc["_id"]),
                user_id=doc["user_id"],
                title=doc["title"],
                message=doc["message"],
                type=doc.get("type", "GENERAL"),
                link=doc.get("link"),
                is_read=doc.get("is_read", False),
                created_at=doc.get("created_at", datetime.now(timezone.utc)),
            )
        )

    return NotificationListResponse(
        notifications=items,
        unread_count=unread_count,
        total=total,
    )


@router.put(
    "/{id}/read",
    status_code=status.HTTP_200_OK,
    summary="Mark Notification as Read",
    description="Marks a specific notification as acknowledged/read.",
)
async def mark_notification_read(
    id: str,
    current_user: UserInDB = Depends(get_current_user),
) -> Dict[str, Any]:
    """Mark single notification as read."""
    notifications_col = get_collection("notifications")
    query = {"_id": ObjectId(id)} if ObjectId.is_valid(id) else {"_id": id}
    query["user_id"] = current_user.id

    result = await notifications_col.update_one(query, {"$set": {"is_read": True}})
    if result.matched_count == 0:
        return {"success": False, "message": "Notification not found or access denied."}

    return {"success": True, "message": "Notification marked as read."}


@router.put(
    "/read-all",
    status_code=status.HTTP_200_OK,
    summary="Mark All Notifications as Read",
    description="Acknowledges all unread notifications for current user.",
)
async def mark_all_read(
    current_user: UserInDB = Depends(get_current_user),
) -> Dict[str, Any]:
    """Mark all pending notifications as read."""
    notifications_col = get_collection("notifications")
    result = await notifications_col.update_many(
        {"user_id": current_user.id, "is_read": False},
        {"$set": {"is_read": True}},
    )

    return {
        "success": True,
        "message": f"{result.modified_count} notifications marked as read.",
    }
