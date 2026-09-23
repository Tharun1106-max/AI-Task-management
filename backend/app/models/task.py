"""Task domain models, statuses, priorities, and comment structures for MongoDB ODM."""

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field
import uuid


class TaskStatus(str, Enum):
    """Workflow state for a task."""
    TODO = "TODO"
    IN_PROGRESS = "IN_PROGRESS"
    IN_REVIEW = "IN_REVIEW"
    COMPLETED = "COMPLETED"
    BLOCKED = "BLOCKED"


class TaskPriority(str, Enum):
    """Urgency / priority classification for a task."""
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class TaskComment(BaseModel):
    """Embedded comment document on a task."""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Comment unique ID")
    user_id: str = Field(..., description="Author user ID")
    user_name: str = Field(..., description="Author full name")
    user_avatar: Optional[str] = Field(default=None, description="Author avatar URL")
    content: str = Field(..., min_length=1, max_length=2000, description="Comment body")
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Comment timestamp",
    )


class TaskAttachment(BaseModel):
    """Embedded attachment document on a task."""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Attachment unique ID")
    file_name: str = Field(..., description="Original file name")
    file_url: str = Field(..., description="Accessible storage URL")
    file_size: Optional[int] = Field(default=None, description="Size in bytes")
    uploaded_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Upload timestamp",
    )


class TaskInDB(BaseModel):
    """Database model representation for Task documents stored in MongoDB."""

    model_config = ConfigDict(
        populate_by_name=True,
        use_enum_values=True,
    )

    id: str = Field(default="", description="Unique string identifier")
    title: str = Field(..., min_length=2, max_length=200, description="Task title")
    description: Optional[str] = Field(default=None, description="Detailed task requirements")
    project_id: str = Field(..., description="Parent project ID reference")
    assignee_id: Optional[str] = Field(default=None, description="Assigned user ID")
    status: TaskStatus = Field(default=TaskStatus.TODO, description="Current workflow state")
    priority: TaskPriority = Field(default=TaskPriority.MEDIUM, description="Task priority")
    due_date: Optional[datetime] = Field(default=None, description="Target completion timestamp")
    dependencies: List[str] = Field(
        default_factory=list,
        description="List of prerequisite task IDs that must complete first",
    )
    tags: List[str] = Field(default_factory=list, description="Categorization tags")
    comments: List[TaskComment] = Field(default_factory=list, description="Discussion comments")
    attachments: List[TaskAttachment] = Field(default_factory=list, description="File attachments")
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Timestamp of task creation",
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Timestamp of last task update",
    )

    def to_mongo(self) -> Dict[str, Any]:
        """Convert model to MongoDB document format."""
        data = self.model_dump(by_alias=True)
        if not data.get("id"):
            data.pop("id", None)
        return data

    @classmethod
    def from_mongo(cls, data: Dict[str, Any]) -> "TaskInDB":
        """Construct TaskInDB instance from raw MongoDB document."""
        if not data:
            raise ValueError("Document cannot be empty.")
        raw = dict(data)
        if "_id" in raw:
            raw["id"] = str(raw.pop("_id"))
        return cls(**raw)
