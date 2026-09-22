"""Pydantic schemas for Team Management and Project Member Invitations."""

from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field

from app.models.user import UserRole


class MemberInviteRequest(BaseModel):
    """Payload schema for inviting or adding a team member to a project."""

    email: EmailStr = Field(..., description="Email address of the invitee")
    role: Optional[UserRole] = Field(
        default=UserRole.MEMBER,
        description="Assigned project authorization role",
    )


class MemberRoleUpdate(BaseModel):
    """Payload schema for updating a project member's role."""

    role: UserRole = Field(..., description="New authorization role")


class ProjectMemberResponse(BaseModel):
    """Member profile with task load and delivery metrics."""

    user_id: str = Field(..., description="Member user ID")
    email: str = Field(..., description="Member email address")
    full_name: str = Field(..., description="Member display name")
    role: UserRole = Field(..., description="Assigned role")
    avatar_url: Optional[str] = Field(default=None, description="Profile avatar URL")
    assigned_tasks_count: int = Field(default=0, description="Tasks currently assigned to member")
    completed_tasks_count: int = Field(default=0, description="Tasks completed by member")
    is_owner: bool = Field(default=False, description="Flag indicating if member is project creator")


class ProjectMemberListResponse(BaseModel):
    """Collection response of project members."""

    project_id: str = Field(..., description="Project ID")
    members: List[ProjectMemberResponse] = Field(..., description="List of project team members")
    total: int = Field(..., description="Total members count")
