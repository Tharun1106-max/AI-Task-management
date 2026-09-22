"""Task management API routes with dependency tracking and project progress recalculation."""

from datetime import datetime, timezone
import logging
import re
from typing import Any, Dict, List, Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.database.mongodb import get_collection
from app.models.project import ProjectInDB
from app.models.task import TaskComment, TaskInDB, TaskPriority, TaskStatus
from app.models.user import UserInDB, UserRole
from app.routes.projects import calculate_project_metrics, verify_project_membership
from app.schemas.task import (
    TaskCommentCreate,
    TaskCommentResponse,
    TaskCreate,
    TaskListResponse,
    TaskResponse,
    TaskUpdate,
)
from app.utils.security import get_current_user
from app.routes.notifications import log_activity, send_notification

logger = logging.getLogger("taskpilot.tasks")
router = APIRouter(prefix="", tags=["Tasks"])


async def get_project_or_404(project_id: str) -> ProjectInDB:
    """Retrieve project document or raise 404."""
    projects_col = get_collection("projects")
    query = {"_id": ObjectId(project_id)} if ObjectId.is_valid(project_id) else {"_id": project_id}
    doc = await projects_col.find_one(query)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Parent project '{project_id}' was not found.",
        )
    return ProjectInDB.from_mongo(doc)


async def enrich_task_response(task: TaskInDB) -> TaskResponse:
    """Populate assignee display details and return typed TaskResponse."""
    assignee_name: Optional[str] = None
    assignee_avatar: Optional[str] = None

    if task.assignee_id:
        users_col = get_collection("users")
        u_query = {"_id": ObjectId(task.assignee_id)} if ObjectId.is_valid(task.assignee_id) else {"_id": task.assignee_id}
        user_doc = await users_col.find_one(u_query)
        if user_doc:
            assignee_name = user_doc.get("full_name")
            assignee_avatar = user_doc.get("avatar_url")

    return TaskResponse(
        id=task.id,
        title=task.title,
        description=task.description,
        project_id=task.project_id,
        assignee_id=task.assignee_id,
        assignee_name=assignee_name,
        assignee_avatar=assignee_avatar,
        status=task.status,
        priority=task.priority,
        due_date=task.due_date,
        dependencies=task.dependencies,
        tags=task.tags,
        comments=[
            TaskCommentResponse(
                id=c.id,
                user_id=c.user_id,
                user_name=c.user_name,
                user_avatar=c.user_avatar,
                content=c.content,
                created_at=c.created_at,
            )
            for c in task.comments
        ],
        attachments=[
            {
                "id": a.id,
                "file_name": a.file_name,
                "file_url": a.file_url,
                "file_size": a.file_size,
                "uploaded_at": a.uploaded_at,
            }
            for a in task.attachments
        ],
        created_at=task.created_at,
        updated_at=task.updated_at,
    )


@router.get(
    "",
    response_model=TaskListResponse,
    summary="List Tasks",
    description="Lists tasks filtered by project, assignee, status, priority, or search term.",
)
async def list_tasks(
    project_id: Optional[str] = Query(None, description="Filter by parent project ID"),
    assignee_id: Optional[str] = Query(None, description="Filter by assignee user ID"),
    status_filter: Optional[TaskStatus] = Query(None, alias="status", description="Filter by status"),
    priority_filter: Optional[TaskPriority] = Query(None, alias="priority", description="Filter by priority"),
    search: Optional[str] = Query(None, description="Search term for title, description, or tags"),
    current_user: UserInDB = Depends(get_current_user),
) -> TaskListResponse:
    """Retrieve tasks with membership verification and filters."""
    tasks_col = get_collection("tasks")
    projects_col = get_collection("projects")

    # If project_id provided, verify user has access to that project
    if project_id:
        project = await get_project_or_404(project_id)
        verify_project_membership(project, current_user)
        accessible_project_ids = [project.id]
    else:
        # Otherwise, restrict to projects the user is a member/owner of (unless platform admin)
        if current_user.role in [UserRole.OWNER, UserRole.ADMIN]:
            accessible_project_ids = None
        else:
            p_cursor = projects_col.find(
                {"$or": [{"owner_id": current_user.id}, {"member_ids": current_user.id}]},
                {"_id": 1},
            )
            accessible_project_ids = [str(p["_id"]) async for p in p_cursor]
            if not accessible_project_ids:
                return TaskListResponse(tasks=[], total=0)

    query: Dict[str, Any] = {}
    if accessible_project_ids is not None:
        query["project_id"] = {"$in": accessible_project_ids}

    if assignee_id:
        query["assignee_id"] = assignee_id
    if status_filter:
        query["status"] = status_filter.value
    if priority_filter:
        query["priority"] = priority_filter.value

    if search:
        regex_pattern = re.compile(re.escape(search), re.IGNORECASE)
        query["$or"] = [
            {"title": {"$regex": regex_pattern}},
            {"description": {"$regex": regex_pattern}},
            {"tags": {"$in": [regex_pattern]}},
        ]

    total = await tasks_col.count_documents(query)
    cursor = tasks_col.find(query).sort("created_at", -1)

    tasks_list: List[TaskResponse] = []
    async for doc in cursor:
        task = TaskInDB.from_mongo(doc)
        tasks_list.append(await enrich_task_response(task))

    return TaskListResponse(tasks=tasks_list, total=total)


@router.post(
    "",
    response_model=TaskResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Task",
    description="Creates a task under an existing project, validating project membership and dependencies.",
)
async def create_task(
    payload: TaskCreate,
    current_user: UserInDB = Depends(get_current_user),
) -> TaskResponse:
    """Create task and recalculate project progress."""
    # 1. Validate parent project & access
    project = await get_project_or_404(payload.project_id)
    verify_project_membership(project, current_user)

    tasks_col = get_collection("tasks")

    # 2. Validate dependencies exist within same project
    if payload.dependencies:
        dep_count = await tasks_col.count_documents({
            "project_id": project.id,
            "_id": {"$in": [ObjectId(d) for d in payload.dependencies if ObjectId.is_valid(d)]},
        })
        if dep_count != len(payload.dependencies):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="One or more specified dependency task IDs are invalid or belong to another project.",
            )

    now = datetime.now(timezone.utc)
    new_task_dict: Dict[str, Any] = {
        "title": payload.title.strip(),
        "description": payload.description.strip() if payload.description else None,
        "project_id": project.id,
        "assignee_id": payload.assignee_id,
        "status": payload.status.value if payload.status else TaskStatus.TODO.value,
        "priority": payload.priority.value if payload.priority else TaskPriority.MEDIUM.value,
        "due_date": payload.due_date,
        "dependencies": payload.dependencies or [],
        "tags": payload.tags or [],
        "comments": [],
        "attachments": [],
        "created_at": now,
        "updated_at": now,
    }

    insert_result = await tasks_col.insert_one(new_task_dict)
    new_task_dict["_id"] = insert_result.inserted_id

    task = TaskInDB.from_mongo(new_task_dict)
    # Recalculate project progress
    await calculate_project_metrics(project.id)

    # Record Activity & Send Notification
    await log_activity(
        user_id=current_user.id,
        user_name=current_user.full_name,
        action="TASK_CREATED",
        description=f"Created task '{task.title}'",
        project_id=project.id,
        project_name=project.name,
    )
    if task.assignee_id and task.assignee_id != current_user.id:
        await send_notification(
            recipient_id=task.assignee_id,
            title="Task Assigned",
            message=f"{current_user.full_name} assigned task '{task.title}' to you in '{project.name}'.",
            notification_type="TASK_ASSIGNED",
            link=f"/tasks?project_id={project.id}",
        )

    logger.info("Task '%s' created in project '%s' by %s", task.title, project.name, current_user.email)
    return await enrich_task_response(task)


@router.get(
    "/{id}",
    response_model=TaskResponse,
    summary="Get Task Details",
    description="Retrieves full task details, including comments timeline and dependencies.",
)
async def get_task(
    id: str,
    current_user: UserInDB = Depends(get_current_user),
) -> TaskResponse:
    """Retrieve task details with membership verification."""
    tasks_col = get_collection("tasks")
    query = {"_id": ObjectId(id)} if ObjectId.is_valid(id) else {"_id": id}

    doc = await tasks_col.find_one(query)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task with ID '{id}' was not found.",
        )

    task = TaskInDB.from_mongo(doc)
    project = await get_project_or_404(task.project_id)
    verify_project_membership(project, current_user)

    return await enrich_task_response(task)


@router.put(
    "/{id}",
    response_model=TaskResponse,
    summary="Update Task Details",
    description="Updates task properties (status, priority, due date, etc.) and recalculates parent project completion metrics.",
)
async def update_task(
    id: str,
    payload: TaskUpdate,
    bypass: bool = Query(default=False, description="Bypass dependency completion status guard"),
    current_user: UserInDB = Depends(get_current_user),
) -> TaskResponse:
    """Update task details and refresh project metrics."""
    tasks_col = get_collection("tasks")
    query = {"_id": ObjectId(id)} if ObjectId.is_valid(id) else {"_id": id}

    doc = await tasks_col.find_one(query)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task with ID '{id}' was not found.",
        )

    task = TaskInDB.from_mongo(doc)
    project = await get_project_or_404(task.project_id)
    verify_project_membership(project, current_user)

    # Status Guard: When updating to COMPLETED, verify all prerequisite tasks are COMPLETED
    if payload.status == TaskStatus.COMPLETED and not bypass:
        deps = task.dependencies or []
        if deps:
            prereq_obj_ids = [ObjectId(d) for d in deps if ObjectId.is_valid(d)]
            prereq_cursor = tasks_col.find({"_id": {"$in": prereq_obj_ids}})
            prereq_docs = await prereq_cursor.to_list(length=100)
            incomplete_prereqs = [
                f"'{p.get('title')}' ({p.get('status')})"
                for p in prereq_docs
                if p.get("status") != TaskStatus.COMPLETED.value
            ]
            if incomplete_prereqs:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Cannot mark task as COMPLETED: {len(incomplete_prereqs)} prerequisite task(s) are not yet COMPLETED: "
                        f"{', '.join(incomplete_prereqs)}. Pass bypass=true to override."
                    ),
                )

    update_fields: Dict[str, Any] = {}
    if payload.title is not None:
        update_fields["title"] = payload.title.strip()
    if payload.description is not None:
        update_fields["description"] = payload.description.strip() or None
    if payload.assignee_id is not None:
        update_fields["assignee_id"] = payload.assignee_id or None
    if payload.status is not None:
        update_fields["status"] = payload.status.value
    if payload.priority is not None:
        update_fields["priority"] = payload.priority.value
    if payload.due_date is not None:
        update_fields["due_date"] = payload.due_date
    if payload.dependencies is not None:
        # Prevent self-dependency
        filtered_deps = [d for d in payload.dependencies if d != task.id]
        update_fields["dependencies"] = filtered_deps
    if payload.tags is not None:
        update_fields["tags"] = payload.tags

    update_fields["updated_at"] = datetime.now(timezone.utc)

    await tasks_col.update_one(query, {"$set": update_fields})
    updated_doc = await tasks_col.find_one(query)
    updated_task = TaskInDB.from_mongo(updated_doc)

    # Recalculate parent project metrics if status changed
    if payload.status is not None:
        await calculate_project_metrics(project.id)

    # Record Activity & Notifications
    if payload.status is not None and payload.status != task.status:
        action_name = "TASK_COMPLETED" if payload.status == TaskStatus.COMPLETED else "STATUS_CHANGED"
        await log_activity(
            user_id=current_user.id,
            user_name=current_user.full_name,
            action=action_name,
            description=f"Moved task '{updated_task.title}' to {payload.status.value}",
            project_id=project.id,
            project_name=project.name,
        )
        if updated_task.assignee_id and updated_task.assignee_id != current_user.id:
            await send_notification(
                recipient_id=updated_task.assignee_id,
                title="Task Status Updated",
                message=f"Task '{updated_task.title}' was updated to {payload.status.value} by {current_user.full_name}.",
                notification_type="TASK_UPDATED",
                link=f"/tasks?project_id={project.id}",
            )

    if payload.assignee_id is not None and payload.assignee_id != task.assignee_id and payload.assignee_id != current_user.id:
        await send_notification(
            recipient_id=payload.assignee_id,
            title="Task Assigned",
            message=f"{current_user.full_name} assigned task '{updated_task.title}' to you in '{project.name}'.",
            notification_type="TASK_ASSIGNED",
            link=f"/tasks?project_id={project.id}",
        )

    logger.info("Task '%s' updated in project '%s' by %s", updated_task.title, project.name, current_user.email)
    return await enrich_task_response(updated_task)


@router.delete(
    "/{id}",
    status_code=status.HTTP_200_OK,
    summary="Delete Task",
    description="Deletes a task and removes its reference from dependencies arrays across all other tasks.",
)
async def delete_task(
    id: str,
    current_user: UserInDB = Depends(get_current_user),
) -> Dict[str, Any]:
    """Delete task and clean up dependency linkages."""
    tasks_col = get_collection("tasks")
    query = {"_id": ObjectId(id)} if ObjectId.is_valid(id) else {"_id": id}

    doc = await tasks_col.find_one(query)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task with ID '{id}' was not found.",
        )

    task = TaskInDB.from_mongo(doc)
    project = await get_project_or_404(task.project_id)
    verify_project_membership(project, current_user)

    # 1. Delete the task
    await tasks_col.delete_one(query)

    # 2. Clean up dependencies referencing this task
    await tasks_col.update_many(
        {"project_id": project.id, "dependencies": task.id},
        {"$pull": {"dependencies": task.id}},
    )

    # 3. Recalculate project metrics
    await calculate_project_metrics(project.id)

    logger.info("Task '%s' (ID: %s) deleted by %s", task.title, task.id, current_user.email)

    return {
        "success": True,
        "message": f"Task '{task.title}' deleted and dependency references cleaned.",
    }


@router.post(
    "/{id}/comments",
    response_model=TaskResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add Task Comment",
    description="Appends a new user comment with author metadata to the task's discussion timeline.",
)
async def add_task_comment(
    id: str,
    payload: TaskCommentCreate,
    current_user: UserInDB = Depends(get_current_user),
) -> TaskResponse:
    """Add comment to task discussion."""
    tasks_col = get_collection("tasks")
    query = {"_id": ObjectId(id)} if ObjectId.is_valid(id) else {"_id": id}

    doc = await tasks_col.find_one(query)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task with ID '{id}' was not found.",
        )

    task = TaskInDB.from_mongo(doc)
    project = await get_project_or_404(task.project_id)
    verify_project_membership(project, current_user)

    new_comment = TaskComment(
        user_id=current_user.id,
        user_name=current_user.full_name,
        user_avatar=current_user.avatar_url,
        content=payload.content.strip(),
        created_at=datetime.now(timezone.utc),
    )

    await tasks_col.update_one(
        query,
        {
            "$push": {"comments": new_comment.model_dump()},
            "$set": {"updated_at": datetime.now(timezone.utc)},
        },
    )

    updated_doc = await tasks_col.find_one(query)
    updated_task = TaskInDB.from_mongo(updated_doc)

    logger.info("Comment added to task '%s' by %s", updated_task.title, current_user.email)
    return await enrich_task_response(updated_task)
