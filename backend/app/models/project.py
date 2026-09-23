"""Project domain models and status definitions for MongoDB ODM."""

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class ProjectStatus(str, Enum):
    """Lifecycle status states for a TaskPilot Project."""
    PLANNING = "PLANNING"
    ACTIVE = "ACTIVE"
    ON_HOLD = "ON_HOLD"
    COMPLETED = "COMPLETED"
    ARCHIVED = "ARCHIVED"


class ProjectInDB(BaseModel):
    """Database model representation for Project documents stored in MongoDB."""

    model_config = ConfigDict(
        populate_by_name=True,
        use_enum_values=True,
    )

    id: str = Field(default="", description="Unique string identifier")
    name: str = Field(..., min_length=2, max_length=150, description="Project display title")
    description: Optional[str] = Field(default=None, description="Detailed project overview or scope")
    owner_id: str = Field(..., description="User ID of project creator / primary owner")
    member_ids: List[str] = Field(default_factory=list, description="List of user IDs with project access")
    start_date: Optional[datetime] = Field(default=None, description="Project scheduled start timestamp")
    deadline: Optional[datetime] = Field(default=None, description="Project scheduled completion deadline")
    status: ProjectStatus = Field(default=ProjectStatus.ACTIVE, description="Current lifecycle status")
    progress: float = Field(default=0.0, ge=0.0, le=100.0, description="Completion percentage (0 - 100)")
    tags: List[str] = Field(default_factory=list, description="Categorization or team tags")
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Timestamp of project creation",
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Timestamp of last update",
    )

    def to_mongo(self) -> Dict[str, Any]:
        """Convert model to MongoDB document format."""
        data = self.model_dump(by_alias=True)
        if not data.get("id"):
            data.pop("id", None)
        return data

    @classmethod
    def from_mongo(cls, data: Dict[str, Any]) -> "ProjectInDB":
        """Construct ProjectInDB instance from raw MongoDB document."""
        if not data:
            raise ValueError("Document cannot be empty.")
        raw = dict(data)
        if "_id" in raw:
            raw["id"] = str(raw.pop("_id"))
        return cls(**raw)
