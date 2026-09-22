"""Project management API routes with membership security and progress calculation."""

from datetime import datetime, timezone
import logging
import re
from typing import Any, Dict, List, Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.database.mongodb import get_collection
from app.models.project import ProjectInDB, ProjectStatus
from app.models.task import TaskStatus
from app.models.user import UserInDB, UserRole
from app.schemas.project import ProjectCreate, ProjectListResponse, ProjectResponse, ProjectUpdate
from app.utils.security import get_current_user

logger = logging.getLogger("taskpilot.projects")
router = APIRouter(prefix="", tags=["Projects"])


async def calculate_project_metrics(project_id: str) -> Dict[str, Any]:
    """Calculate total tasks, completed tasks, and completion progress for a project."""
    tasks_col = get_collection("tasks")
    total_tasks = await tasks_col.count_documents({"project_id": project_id})
    completed_tasks = await tasks_col.count_documents({
        "project_id": project_id,
        "status": TaskStatus.COMPLETED.value,
    })

    progress = round((completed_tasks / total_tasks * 100), 1) if total_tasks > 0 else 0.0

    # Also update project document in background if progress drifted
    projects_col = get_collection("projects")
    if ObjectId.is_valid(project_id):
        await projects_col.update_one(
            {"_id": ObjectId(project_id)},
            {"$set": {"progress": progress, "updated_at": datetime.now(timezone.utc)}},
        )

    return {
        "total_tasks": total_tasks,
        "completed_tasks": completed_tasks,
        "progress": progress,
    }


def verify_project_membership(project: ProjectInDB, user: UserInDB) -> None:
    """Verify that user is either platform admin/owner, project creator, or project member."""
    if user.role in [UserRole.OWNER, UserRole.ADMIN]:
        return
    if project.owner_id == user.id or user.id in project.member_ids:
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Access denied: You are not a member of this project.",
    )


def verify_project_admin(project: ProjectInDB, user: UserInDB) -> None:
    """Verify that user is either platform admin/owner or project creator."""
    if user.role in [UserRole.OWNER, UserRole.ADMIN] or project.owner_id == user.id:
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Action requires project owner or administrator privileges.",
    )


async def get_project_or_404(project_id: str) -> ProjectInDB:
    """Fetch project by ID or raise 404/400 HTTPException."""
    query = {"_id": ObjectId(project_id)} if ObjectId.is_valid(project_id) else {"_id": project_id}
    projects_col = get_collection("projects")
    doc = await projects_col.find_one(query)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID '{project_id}' was not found.",
        )
    return ProjectInDB.from_mongo(doc)



@router.get(
    "",
    response_model=ProjectListResponse,
    summary="List Projects",
    description="Lists all projects accessible to current user with optional filtering by status and search query.",
)
async def list_projects(
    status_filter: Optional[ProjectStatus] = Query(None, alias="status", description="Filter by status"),
    search: Optional[str] = Query(None, description="Search term for name or tags"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    current_user: UserInDB = Depends(get_current_user),
) -> ProjectListResponse:
    """List accessible projects with live progress calculation."""
    projects_col = get_collection("projects")

    # Base query: membership or elevated role
    query: Dict[str, Any] = {}
    if current_user.role not in [UserRole.OWNER, UserRole.ADMIN]:
        query["$or"] = [
            {"owner_id": current_user.id},
            {"member_ids": current_user.id},
        ]

    if status_filter:
        query["status"] = status_filter.value

    if search:
        regex_pattern = re.compile(re.escape(search), re.IGNORECASE)
        search_filter = [
            {"name": {"$regex": regex_pattern}},
            {"tags": {"$in": [regex_pattern]}},
        ]
        if "$or" in query:
            query = {"$and": [query, {"$or": search_filter}]}
        else:
            query["$or"] = search_filter

    total = await projects_col.count_documents(query)
    skip = (page - 1) * limit
    cursor = projects_col.find(query).sort("created_at", -1).skip(skip).limit(limit)

    results: List[ProjectResponse] = []
    async for doc in cursor:
        project = ProjectInDB.from_mongo(doc)
        metrics = await calculate_project_metrics(project.id)
        results.append(
            ProjectResponse(
                id=project.id,
                name=project.name,
                description=project.description,
                owner_id=project.owner_id,
                member_ids=project.member_ids,
                start_date=project.start_date,
                deadline=project.deadline,
                status=project.status,
                progress=metrics["progress"],
                tags=project.tags,
                total_tasks=metrics["total_tasks"],
                completed_tasks=metrics["completed_tasks"],
                created_at=project.created_at,
                updated_at=project.updated_at,
            )
        )

    return ProjectListResponse(
        projects=results,
        total=total,
        page=page,
        limit=limit,
    )


@router.post(
    "",
    response_model=ProjectResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Project",
    description="Creates a new project and designates current user as primary owner.",
)
async def create_project(
    payload: ProjectCreate,
    current_user: UserInDB = Depends(get_current_user),
) -> ProjectResponse:
    """Create a new project record in MongoDB."""
    projects_col = get_collection("projects")

    # Ensure creator is included in member_ids
    member_ids = list(set(payload.member_ids or []))
    if current_user.id not in member_ids:
        member_ids.append(current_user.id)

    now = datetime.now(timezone.utc)
    new_project_dict: Dict[str, Any] = {
        "name": payload.name.strip(),
        "description": payload.description.strip() if payload.description else None,
        "owner_id": current_user.id,
        "member_ids": member_ids,
        "start_date": payload.start_date,
        "deadline": payload.deadline,
        "status": payload.status.value if payload.status else ProjectStatus.ACTIVE.value,
        "progress": 0.0,
        "tags": payload.tags or [],
        "created_at": now,
        "updated_at": now,
    }

    insert_result = await projects_col.insert_one(new_project_dict)
    project_id = str(insert_result.inserted_id)
    new_project_dict["_id"] = insert_result.inserted_id

    project = ProjectInDB.from_mongo(new_project_dict)
    logger.info("Project created: '%s' (ID: %s) by user %s", project.name, project_id, current_user.email)

    return ProjectResponse(
        id=project_id,
        name=project.name,
        description=project.description,
        owner_id=project.owner_id,
        member_ids=project.member_ids,
        start_date=project.start_date,
        deadline=project.deadline,
        status=project.status,
        progress=0.0,
        tags=project.tags,
        total_tasks=0,
        completed_tasks=0,
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


@router.get(
    "/{id}",
    response_model=ProjectResponse,
    summary="Get Project Details",
    description="Retrieves a single project with dynamically calculated task metrics.",
)
async def get_project(
    id: str,
    current_user: UserInDB = Depends(get_current_user),
) -> ProjectResponse:
    """Retrieve project by ID with security validation."""
    projects_col = get_collection("projects")
    query = {"_id": ObjectId(id)} if ObjectId.is_valid(id) else {"_id": id}

    doc = await projects_col.find_one(query)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID '{id}' was not found.",
        )

    project = ProjectInDB.from_mongo(doc)
    verify_project_membership(project, current_user)

    metrics = await calculate_project_metrics(project.id)

    return ProjectResponse(
        id=project.id,
        name=project.name,
        description=project.description,
        owner_id=project.owner_id,
        member_ids=project.member_ids,
        start_date=project.start_date,
        deadline=project.deadline,
        status=project.status,
        progress=metrics["progress"],
        tags=project.tags,
        total_tasks=metrics["total_tasks"],
        completed_tasks=metrics["completed_tasks"],
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


@router.put(
    "/{id}",
    response_model=ProjectResponse,
    summary="Update Project",
    description="Modifies project attributes. Requires project owner or platform admin privileges.",
)
async def update_project(
    id: str,
    payload: ProjectUpdate,
    current_user: UserInDB = Depends(get_current_user),
) -> ProjectResponse:
    """Update project details."""
    projects_col = get_collection("projects")
    query = {"_id": ObjectId(id)} if ObjectId.is_valid(id) else {"_id": id}

    doc = await projects_col.find_one(query)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID '{id}' was not found.",
        )

    project = ProjectInDB.from_mongo(doc)
    verify_project_admin(project, current_user)

    update_fields: Dict[str, Any] = {}
    if payload.name is not None:
        update_fields["name"] = payload.name.strip()
    if payload.description is not None:
        update_fields["description"] = payload.description.strip() or None
    if payload.member_ids is not None:
        # Guarantee owner remains in member_ids
        updated_members = list(set(payload.member_ids))
        if project.owner_id not in updated_members:
            updated_members.append(project.owner_id)
        update_fields["member_ids"] = updated_members
    if payload.start_date is not None:
        update_fields["start_date"] = payload.start_date
    if payload.deadline is not None:
        update_fields["deadline"] = payload.deadline
    if payload.status is not None:
        update_fields["status"] = payload.status.value
    if payload.tags is not None:
        update_fields["tags"] = payload.tags

    update_fields["updated_at"] = datetime.now(timezone.utc)

    await projects_col.update_one(query, {"$set": update_fields})
    updated_doc = await projects_col.find_one(query)
    updated_project = ProjectInDB.from_mongo(updated_doc)
    metrics = await calculate_project_metrics(updated_project.id)

    logger.info("Project '%s' updated by %s", updated_project.name, current_user.email)

    return ProjectResponse(
        id=updated_project.id,
        name=updated_project.name,
        description=updated_project.description,
        owner_id=updated_project.owner_id,
        member_ids=updated_project.member_ids,
        start_date=updated_project.start_date,
        deadline=updated_project.deadline,
        status=updated_project.status,
        progress=metrics["progress"],
        tags=updated_project.tags,
        total_tasks=metrics["total_tasks"],
        completed_tasks=metrics["completed_tasks"],
        created_at=updated_project.created_at,
        updated_at=updated_project.updated_at,
    )


@router.delete(
    "/{id}",
    status_code=status.HTTP_200_OK,
    summary="Delete Project",
    description="Deletes a project and cascades cleanup across all associated tasks. Requires owner or admin.",
)
async def delete_project(
    id: str,
    current_user: UserInDB = Depends(get_current_user),
) -> Dict[str, Any]:
    """Delete project and cascade delete tasks."""
    projects_col = get_collection("projects")
    query = {"_id": ObjectId(id)} if ObjectId.is_valid(id) else {"_id": id}

    doc = await projects_col.find_one(query)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID '{id}' was not found.",
        )

    project = ProjectInDB.from_mongo(doc)
    verify_project_admin(project, current_user)

    # Delete project
    await projects_col.delete_one(query)

    # Cascade delete all tasks belonging to this project
    tasks_col = get_collection("tasks")
    delete_tasks_res = await tasks_col.delete_many({"project_id": project.id})

    logger.info(
        "Project '%s' deleted by %s. Cascaded %s tasks.",
        project.name,
        current_user.email,
        delete_tasks_res.deleted_count,
    )

    return {
        "success": True,
        "message": f"Project '{project.name}' and {delete_tasks_res.deleted_count} associated tasks successfully removed.",
    }


@router.get(
    "/{id}/export",
    summary="Export Complete Project Archive",
    description="Serializes complete project data (specifications, tasks, comments, dependencies, and activity) into structured JSON for offline backup.",
)
async def export_project(
    id: str,
    current_user: UserInDB = Depends(get_current_user),
) -> Dict[str, Any]:
    """Exports full project backup bundle as structured JSON."""
    project = await get_project_or_404(id)
    verify_project_membership(project, current_user)

    tasks_col = get_collection("tasks")
    activities_col = get_collection("activities")
    users_col = get_collection("users")

    # Fetch all tasks
    task_docs = await tasks_col.find({"project_id": project.id}).to_list(length=1000)
    tasks_cleaned = []
    for t in task_docs:
        t_copy = dict(t)
        t_copy["id"] = str(t_copy.pop("_id"))
        tasks_cleaned.append(t_copy)

    # Fetch recent activities
    act_docs = await activities_col.find({"project_id": project.id}).sort("created_at", -1).limit(100).to_list(length=100)
    acts_cleaned = []
    for a in act_docs:
        a_copy = dict(a)
        a_copy["id"] = str(a_copy.pop("_id"))
        acts_cleaned.append(a_copy)

    # Fetch team member info
    member_obj_ids = [ObjectId(mid) for mid in project.member_ids if ObjectId.is_valid(mid)]
    member_docs = await users_col.find(
        {"_id": {"$in": member_obj_ids}},
        {"hashed_password": 0},
    ).to_list(length=100)
    members_cleaned = [{"id": str(m["_id"]), "email": m.get("email"), "full_name": m.get("full_name"), "role": m.get("role")} for m in member_docs]

    metrics = await calculate_project_metrics(project.id)

    export_bundle = {
        "export_metadata": {
            "version": "1.0",
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "exported_by": current_user.email,
        },
        "project": {
            "id": project.id,
            "name": project.name,
            "description": project.description,
            "owner_id": project.owner_id,
            "status": project.status,
            "tags": project.tags,
            "metrics": metrics,
            "start_date": project.start_date.isoformat() if project.start_date else None,
            "deadline": project.deadline.isoformat() if project.deadline else None,
            "created_at": project.created_at.isoformat() if project.created_at else None,
        },
        "members": members_cleaned,
        "tasks": tasks_cleaned,
        "activities": acts_cleaned,
    }

    logger.info("Project [%s] exported as JSON by %s", project.name, current_user.email)
    return export_bundle

