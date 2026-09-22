"""Pydantic request and response schemas for Projects."""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.models.project import ProjectStatus


class ProjectCreate(BaseModel):
    """Payload schema for creating a new project."""

    name: str = Field(..., min_length=2, max_length=150, description="Project title")
    description: Optional[str] = Field(default=None, max_length=2000, description="Project scope")
    member_ids: Optional[List[str]] = Field(default_factory=list, description="Initial team member IDs")
    start_date: Optional[datetime] = Field(default=None, description="Start date")
    deadline: Optional[datetime] = Field(default=None, description="Deadline timestamp")
    status: Optional[ProjectStatus] = Field(default=ProjectStatus.ACTIVE, description="Initial status")
    tags: Optional[List[str]] = Field(default_factory=list, description="Categorization tags")


class ProjectUpdate(BaseModel):
    """Payload schema for modifying an existing project."""

    name: Optional[str] = Field(default=None, min_length=2, max_length=150)
    description: Optional[str] = Field(default=None, max_length=2000)
    member_ids: Optional[List[str]] = None
    start_date: Optional[datetime] = None
    deadline: Optional[datetime] = None
    status: Optional[ProjectStatus] = None
    tags: Optional[List[str]] = None


class ProjectResponse(BaseModel):
    """Sanitized public project response with live task metrics."""

    model_config = ConfigDict(from_attributes=True)

    id: str = Field(..., description="Unique project ID")
    name: str = Field(..., description="Project title")
    description: Optional[str] = Field(default=None, description="Project scope description")
    owner_id: str = Field(..., description="Project owner user ID")
    member_ids: List[str] = Field(default_factory=list, description="Member user IDs")
    start_date: Optional[datetime] = Field(default=None, description="Start date")
    deadline: Optional[datetime] = Field(default=None, description="Deadline date")
    status: ProjectStatus = Field(..., description="Project status")
    progress: float = Field(default=0.0, description="Completion percentage (0-100)")
    tags: List[str] = Field(default_factory=list, description="Tags")
    total_tasks: int = Field(default=0, description="Total number of tasks in this project")
    completed_tasks: int = Field(default=0, description="Number of completed tasks")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")


class ProjectListResponse(BaseModel):
    """Paginated collection of projects."""

    projects: List[ProjectResponse] = Field(..., description="List of projects")
    total: int = Field(..., description="Total matching projects count")
    page: int = Field(default=1, description="Current page number")
    limit: int = Field(default=20, description="Page limit")
