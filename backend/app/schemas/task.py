"""Pydantic request and response schemas for Tasks."""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.models.task import TaskPriority, TaskStatus


# ==============================================================================
# Embedded Schemas
# ==============================================================================

class TaskCommentCreate(BaseModel):
    """Payload schema for adding a comment to a task."""
    content: str = Field(..., min_length=1, max_length=2000, description="Comment text content")


class TaskCommentResponse(BaseModel):
    """Comment response schema."""
    id: str = Field(..., description="Unique comment ID")
    user_id: str = Field(..., description="Author user ID")
    user_name: str = Field(..., description="Author full name")
    user_avatar: Optional[str] = Field(default=None, description="Author avatar URL")
    content: str = Field(..., description="Comment text content")
    created_at: datetime = Field(..., description="Comment timestamp")


class TaskAttachmentResponse(BaseModel):
    """Attachment response schema."""
    id: str = Field(..., description="Unique attachment ID")
    file_name: str = Field(..., description="File display name")
    file_url: str = Field(..., description="Download/view URL")
    file_size: Optional[int] = Field(default=None, description="Size in bytes")
    uploaded_at: datetime = Field(..., description="Upload timestamp")


# ==============================================================================
# Task CRUD Schemas
# ==============================================================================

class TaskCreate(BaseModel):
    """Payload schema for creating a new task."""

    title: str = Field(..., min_length=2, max_length=200, description="Task title")
    description: Optional[str] = Field(default=None, max_length=5000, description="Detailed description")
    project_id: str = Field(..., description="Parent project ID")
    assignee_id: Optional[str] = Field(default=None, description="Assigned team member ID")
    status: Optional[TaskStatus] = Field(default=TaskStatus.TODO, description="Workflow status")
    priority: Optional[TaskPriority] = Field(default=TaskPriority.MEDIUM, description="Task urgency level")
    due_date: Optional[datetime] = Field(default=None, description="Due date timestamp")
    dependencies: Optional[List[str]] = Field(
        default_factory=list,
        description="IDs of prerequisite tasks that must complete first",
    )
    tags: Optional[List[str]] = Field(default_factory=list, description="Tags")


class TaskUpdate(BaseModel):
    """Payload schema for updating task details."""

    title: Optional[str] = Field(default=None, min_length=2, max_length=200)
    description: Optional[str] = Field(default=None, max_length=5000)
    assignee_id: Optional[str] = None
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    due_date: Optional[datetime] = None
    dependencies: Optional[List[str]] = None
    tags: Optional[List[str]] = None


class TaskResponse(BaseModel):
    """Complete task response representation."""

    model_config = ConfigDict(from_attributes=True)

    id: str = Field(..., description="Unique task ID")
    title: str = Field(..., description="Task title")
    description: Optional[str] = Field(default=None, description="Detailed description")
    project_id: str = Field(..., description="Parent project ID")
    assignee_id: Optional[str] = Field(default=None, description="Assigned team member ID")
    assignee_name: Optional[str] = Field(default=None, description="Display name of assignee")
    assignee_avatar: Optional[str] = Field(default=None, description="Avatar of assignee")
    status: TaskStatus = Field(..., description="Workflow status")
    priority: TaskPriority = Field(..., description="Task priority")
    due_date: Optional[datetime] = Field(default=None, description="Target completion timestamp")
    dependencies: List[str] = Field(default_factory=list, description="Prerequisite task IDs")
    tags: List[str] = Field(default_factory=list, description="Tags")
    comments: List[TaskCommentResponse] = Field(default_factory=list, description="Comments timeline")
    attachments: List[TaskAttachmentResponse] = Field(default_factory=list, description="Attachments")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Update timestamp")


class TaskListResponse(BaseModel):
    """Collection of tasks."""

    tasks: List[TaskResponse] = Field(..., description="List of tasks")
    total: int = Field(..., description="Total tasks count")
