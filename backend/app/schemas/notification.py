"""Pydantic schemas for Activity Logs, Notifications, and Calendar Events."""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class NotificationResponse(BaseModel):
    """Notification item for user alert stream."""

    id: str = Field(..., description="Unique notification ID")
    user_id: str = Field(..., description="Target recipient user ID")
    title: str = Field(..., description="Notification headline")
    message: str = Field(..., description="Detailed notification message")
    type: str = Field(..., description="Notification category")
    link: Optional[str] = Field(default=None, description="Action destination link")
    is_read: bool = Field(default=False, description="Read state flag")
    created_at: datetime = Field(..., description="Timestamp of notification")


class NotificationListResponse(BaseModel):
    """Paginated collection of notifications."""

    notifications: List[NotificationResponse] = Field(..., description="List of notifications")
    unread_count: int = Field(..., description="Count of unread notifications")
    total: int = Field(..., description="Total notifications count")


class CalendarEventResponse(BaseModel):
    """Calendar agenda item representing a task deadline or project milestone."""

    id: str = Field(..., description="Event unique ID (task or project ID)")
    title: str = Field(..., description="Event display title")
    type: str = Field(..., description="'TASK' or 'PROJECT'")
    date: datetime = Field(..., description="Scheduled due date or deadline")
    priority: Optional[str] = Field(default=None, description="Task urgency level")
    status: str = Field(..., description="Current lifecycle state")
    project_id: str = Field(..., description="Parent project ID")
    project_name: str = Field(..., description="Parent project display name")
    is_overdue: bool = Field(default=False, description="Whether event date is in the past and unfinished")


class CalendarEventsListResponse(BaseModel):
    """Collection response of calendar events."""

    events: List[CalendarEventResponse] = Field(..., description="List of calendar events")
    total: int = Field(..., description="Total events count")
