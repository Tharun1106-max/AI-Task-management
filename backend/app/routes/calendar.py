"""Calendar Schedule & Milestone API Routes."""

from datetime import datetime, timezone
import logging
from typing import Any, Dict, List, Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, Query

from app.database.mongodb import get_collection
from app.models.project import ProjectInDB
from app.models.task import TaskInDB
from app.models.user import UserInDB, UserRole
from app.schemas.notification import CalendarEventResponse, CalendarEventsListResponse
from app.utils.security import get_current_user

logger = logging.getLogger("taskpilot.calendar")
router = APIRouter(prefix="", tags=["Calendar Schedule"])


@router.get(
    "/events",
    response_model=CalendarEventsListResponse,
    summary="Get Calendar Schedule Events",
    description="Retrieves scheduled task deadlines and project milestones across accessible projects.",
)
async def get_calendar_events(
    project_id: Optional[str] = Query(None, description="Filter by parent project ID"),
    start_date: Optional[datetime] = Query(None, description="Start date window"),
    end_date: Optional[datetime] = Query(None, description="End date window"),
    current_user: UserInDB = Depends(get_current_user),
) -> CalendarEventsListResponse:
    """Fetch consolidated calendar agenda events for tasks and projects."""
    projects_col = get_collection("projects")
    tasks_col = get_collection("tasks")
    now = datetime.now(timezone.utc)

    # 1. Determine accessible project IDs
    p_query: Dict[str, Any] = {}
    if current_user.role not in [UserRole.OWNER, UserRole.ADMIN]:
        p_query["$or"] = [
            {"owner_id": current_user.id},
            {"member_ids": current_user.id},
        ]
    if project_id:
        p_query["_id"] = ObjectId(project_id) if ObjectId.is_valid(project_id) else project_id

    projects_cursor = projects_col.find(p_query)
    project_map: Dict[str, ProjectInDB] = {}
    async for p_doc in projects_cursor:
        proj = ProjectInDB.from_mongo(p_doc)
        project_map[proj.id] = proj

    accessible_project_ids = list(project_map.keys())
    if not accessible_project_ids:
        return CalendarEventsListResponse(events=[], total=0)

    events: List[CalendarEventResponse] = []

    # 2. Add Project Milestone Deadlines
    for proj in project_map.values():
        if proj.deadline:
            if start_date and proj.deadline < start_date:
                continue
            if end_date and proj.deadline > end_date:
                continue

            is_overdue = proj.deadline < now and proj.status != "COMPLETED"
            events.append(
                CalendarEventResponse(
                    id=f"proj_{proj.id}",
                    title=f"[Project Delivery] {proj.name}",
                    type="PROJECT",
                    date=proj.deadline,
                    priority="HIGH",
                    status=proj.status,
                    project_id=proj.id,
                    project_name=proj.name,
                    is_overdue=is_overdue,
                )
            )

    # 3. Add Task Due Dates
    task_query: Dict[str, Any] = {
        "project_id": {"$in": accessible_project_ids},
        "due_date": {"$ne": None},
    }
    if start_date or end_date:
        task_query["due_date"] = {}
        if start_date:
            task_query["due_date"]["$gte"] = start_date
        if end_date:
            task_query["due_date"]["$lte"] = end_date

    tasks_cursor = tasks_col.find(task_query).sort("due_date", 1)

    async for t_doc in tasks_cursor:
        task = TaskInDB.from_mongo(t_doc)
        if not task.due_date:
            continue

        parent_proj = project_map.get(task.project_id)
        proj_name = parent_proj.name if parent_proj else "Project"
        is_overdue = task.due_date < now and task.status != "COMPLETED"

        events.append(
            CalendarEventResponse(
                id=task.id,
                title=task.title,
                type="TASK",
                date=task.due_date,
                priority=task.priority,
                status=task.status,
                project_id=task.project_id,
                project_name=proj_name,
                is_overdue=is_overdue,
            )
        )

    # Sort all events chronologically
    events.sort(key=lambda ev: ev.date)

    return CalendarEventsListResponse(
        events=events,
        total=len(events),
    )
