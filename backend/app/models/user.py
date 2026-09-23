"""User domain models and role definitions for MongoDB ODM."""

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserRole(str, Enum):
    """Hierarchical role definitions for TaskPilot team members."""
    OWNER = "OWNER"
    ADMIN = "ADMIN"
    MEMBER = "MEMBER"
    VIEWER = "VIEWER"


class UserInDB(BaseModel):
    """Database model representation for User stored in MongoDB."""

    model_config = ConfigDict(
        populate_by_name=True,
        use_enum_values=True,
    )

    id: str = Field(default="", description="Unique identifier (stringified ObjectId or UUID)")
    email: EmailStr = Field(..., description="Unique email address")
    hashed_password: str = Field(..., description="Bcrypt-hashed secret password")
    full_name: str = Field(..., min_length=2, max_length=100, description="Full name of user")
    role: UserRole = Field(default=UserRole.MEMBER, description="Assigned authorization role")
    avatar_url: Optional[str] = Field(default=None, description="Profile picture URL")
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Timestamp of user account creation",
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Timestamp of last account update",
    )

    def to_mongo(self) -> Dict[str, Any]:
        """Convert model to MongoDB document dictionary representation."""
        data = self.model_dump(by_alias=True)
        # Strip id if empty string so MongoDB can assign _id if needed, or map id -> _id
        if not data.get("id"):
            data.pop("id", None)
        return data

    @classmethod
    def from_mongo(cls, data: Dict[str, Any]) -> "UserInDB":
        """Construct UserInDB from raw MongoDB document."""
        if not data:
            raise ValueError("Document cannot be empty.")
        raw = dict(data)
        if "_id" in raw:
            raw["id"] = str(raw.pop("_id"))
        return cls(**raw)


# Canonical alias for compatibility
User = UserInDB

