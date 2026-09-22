"""Team & Project Membership Management API Routes."""

from datetime import datetime, timezone
import logging
from typing import Any, Dict, List
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from app.database.mongodb import get_collection
from app.models.project import ProjectInDB
from app.models.task import TaskStatus
from app.models.user import UserInDB, UserRole
from app.routes.projects import get_project, verify_project_admin, verify_project_membership
from app.schemas.team import (
    MemberInviteRequest,
    MemberRoleUpdate,
    ProjectMemberListResponse,
    ProjectMemberResponse,
)
from app.utils.security import get_current_user

logger = logging.getLogger("taskpilot.team")
router = APIRouter(prefix="", tags=["Team Collaboration"])


async def get_project_by_id(project_id: str) -> ProjectInDB:
    """Helper to fetch project by ID."""
    projects_col = get_collection("projects")
    query = {"_id": ObjectId(project_id)} if ObjectId.is_valid(project_id) else {"_id": project_id}
    doc = await projects_col.find_one(query)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID '{project_id}' was not found.",
        )
    return ProjectInDB.from_mongo(doc)


@router.get(
    "/projects/{id}/members",
    response_model=ProjectMemberListResponse,
    summary="List Project Members",
    description="Lists all team members assigned to a project with their respective task workload metrics.",
)
async def list_project_members(
    id: str,
    current_user: UserInDB = Depends(get_current_user),
) -> ProjectMemberListResponse:
    """List members and their task loads."""
    project = await get_project_by_id(id)
    verify_project_membership(project, current_user)

    users_col = get_collection("users")
    tasks_col = get_collection("tasks")

    member_responses: List[ProjectMemberResponse] = []

    # Ensure owner is in member IDs list
    all_member_ids = list(set([project.owner_id] + (project.member_ids or [])))

    for member_id in all_member_ids:
        u_query = {"_id": ObjectId(member_id)} if ObjectId.is_valid(member_id) else {"_id": member_id}
        user_doc = await users_col.find_one(u_query)

        if user_doc:
            user_in_db = UserInDB.from_mongo(user_doc)
            # Count assigned tasks in this project
            assigned_count = await tasks_col.count_documents({
                "project_id": project.id,
                "assignee_id": member_id,
            })
            completed_count = await tasks_col.count_documents({
                "project_id": project.id,
                "assignee_id": member_id,
                "status": TaskStatus.COMPLETED.value,
            })

            member_responses.append(
                ProjectMemberResponse(
                    user_id=user_in_db.id,
                    email=user_in_db.email,
                    full_name=user_in_db.full_name,
                    role=user_in_db.role,
                    avatar_url=user_in_db.avatar_url,
                    assigned_tasks_count=assigned_count,
                    completed_tasks_count=completed_count,
                    is_owner=(user_in_db.id == project.owner_id),
                )
            )

    return ProjectMemberListResponse(
        project_id=project.id,
        members=member_responses,
        total=len(member_responses),
    )


@router.post(
    "/projects/{id}/members",
    response_model=ProjectMemberResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Invite Member to Project",
    description="Invites an existing user by email to join the project team.",
)
async def invite_member(
    id: str,
    payload: MemberInviteRequest,
    current_user: UserInDB = Depends(get_current_user),
) -> ProjectMemberResponse:
    """Add or invite user to project."""
    project = await get_project_by_id(id)
    verify_project_admin(project, current_user)

    users_col = get_collection("users")
    projects_col = get_collection("projects")
    notifications_col = get_collection("notifications")

    normalized_email = payload.email.strip().lower()
    target_user_doc = await users_col.find_one({"email": normalized_email})

    if not target_user_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with email '{normalized_email}' was not found. They must first create an account on TaskPilot.",
        )

    target_user = UserInDB.from_mongo(target_user_doc)

    # Check if already a member
    if target_user.id in project.member_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{target_user.full_name} is already a member of this project.",
        )

    # Add to member_ids
    await projects_col.update_one(
        {"_id": ObjectId(project.id)},
        {"$addToSet": {"member_ids": target_user.id}, "$set": {"updated_at": datetime.now(timezone.utc)}},
    )

    # Send Notification to invited user
    now = datetime.now(timezone.utc)
    invited_role = getattr(payload.role, "value", payload.role) if payload.role else "MEMBER"
    await notifications_col.insert_one({
        "user_id": target_user.id,
        "title": "Invited to Project",
        "message": f"You were invited to join '{project.name}' as a {invited_role}.",
        "type": "MEMBER_INVITED",
        "link": f"/tasks?project_id={project.id}",
        "is_read": False,
        "created_at": now,
    })

    logger.info("User '%s' added to project '%s' by %s", target_user.email, project.name, current_user.email)

    return ProjectMemberResponse(
        user_id=target_user.id,
        email=target_user.email,
        full_name=target_user.full_name,
        role=payload.role if payload.role else UserRole.MEMBER,
        avatar_url=target_user.avatar_url,
        assigned_tasks_count=0,
        completed_tasks_count=0,
        is_owner=(target_user.id == project.owner_id),
    )


@router.put(
    "/projects/{id}/members/{user_id}",
    response_model=Dict[str, Any],
    summary="Update Member Role",
    description="Updates a project member's role (owner/admin only).",
)
async def update_member_role(
    id: str,
    user_id: str,
    payload: MemberRoleUpdate,
    current_user: UserInDB = Depends(get_current_user),
) -> Dict[str, Any]:
    """Modify member authorization role."""
    project = await get_project_by_id(id)
    verify_project_admin(project, current_user)

    if user_id == project.owner_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot modify the primary project owner's role.",
        )

    users_col = get_collection("users")
    u_query = {"_id": ObjectId(user_id)} if ObjectId.is_valid(user_id) else {"_id": user_id}
    updated_role = getattr(payload.role, "value", payload.role)
    await users_col.update_one(u_query, {"$set": {"role": updated_role}})

    return {
        "success": True,
        "message": f"Member role updated to {updated_role}.",
    }


@router.delete(
    "/projects/{id}/members/{user_id}",
    status_code=status.HTTP_200_OK,
    summary="Remove Member from Project",
    description="Removes a member from the project and unassigns their active tasks.",
)
async def remove_member(
    id: str,
    user_id: str,
    current_user: UserInDB = Depends(get_current_user),
) -> Dict[str, Any]:
    """Remove user from project membership."""
    project = await get_project_by_id(id)

    # User can remove themselves or admin can remove
    if current_user.id != user_id:
        verify_project_admin(project, current_user)

    if user_id == project.owner_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove the project owner from the project.",
        )

    projects_col = get_collection("projects")
    tasks_col = get_collection("tasks")

    # Pull user_id from member_ids
    await projects_col.update_one(
        {"_id": ObjectId(project.id)},
        {"$pull": {"member_ids": user_id}, "$set": {"updated_at": datetime.now(timezone.utc)}},
    )

    # Unassign user from tasks in this project
    await tasks_col.update_many(
        {"project_id": project.id, "assignee_id": user_id},
        {"$set": {"assignee_id": None, "updated_at": datetime.now(timezone.utc)}},
    )

    logger.info("User '%s' removed from project '%s' by %s", user_id, project.name, current_user.email)

    return {
        "success": True,
        "message": "Member successfully removed from project.",
    }
