"""Executive Analytics & Aggregation Engine for TaskPilot."""

from datetime import datetime, timedelta, timezone
import logging
from typing import Any, Dict, List
from bson import ObjectId
from fastapi import APIRouter, Depends

from app.database.mongodb import get_collection
from app.models.task import TaskPriority, TaskStatus
from app.models.user import UserInDB, UserRole
from app.schemas.analytics import (
    ActivityItem,
    DashboardAnalyticsResponse,
    DistributionItem,
    ProjectProgressSummary,
    SummaryMetrics,
    UpcomingTaskItem,
    WeeklyTrendItem,
)
from app.utils.security import get_current_user

logger = logging.getLogger("taskpilot.analytics")
router = APIRouter(prefix="", tags=["Analytics"])


@router.get(
    "/dashboard",
    response_model=DashboardAnalyticsResponse,
    summary="Get Executive Dashboard Analytics",
    description="Calculates real-time aggregation metrics, distribution breakdowns, and upcoming deadlines using MongoDB pipelines.",
)
async def get_dashboard_analytics(
    current_user: UserInDB = Depends(get_current_user),
) -> DashboardAnalyticsResponse:
    """Execute high-performance aggregation pipelines for dashboard metrics."""
    projects_col = get_collection("projects")
    tasks_col = get_collection("tasks")

    now = datetime.now(timezone.utc)

    # 1. Fetch user's accessible projects
    p_query: Dict[str, Any] = {}
    if current_user.role not in [UserRole.OWNER, UserRole.ADMIN]:
        p_query["$or"] = [
            {"owner_id": current_user.id},
            {"member_ids": current_user.id},
        ]

    projects_cursor = projects_col.find(p_query, {"_id": 1, "name": 1, "status": 1, "progress": 1, "created_at": 1})
    project_map: Dict[str, str] = {}
    accessible_projects: List[Dict[str, Any]] = []

    async for p in projects_cursor:
        pid = str(p["_id"])
        pname = p.get("name", "Untitled Project")
        project_map[pid] = pname
        accessible_projects.append({
            "id": pid,
            "name": pname,
            "status": p.get("status", "ACTIVE"),
            "progress": float(p.get("progress", 0.0)),
        })

    total_projects = len(accessible_projects)
    accessible_project_ids = list(project_map.keys())

    # If user has no projects yet, return empty zero-state response
    if not accessible_project_ids and current_user.role not in [UserRole.OWNER, UserRole.ADMIN]:
        return DashboardAnalyticsResponse(
            summary=SummaryMetrics(
                total_projects=0,
                total_tasks=0,
                completed_tasks=0,
                in_progress_tasks=0,
                overdue_tasks=0,
                overall_completion_rate=0.0,
            ),
            project_progress=[],
            status_distribution=[],
            priority_distribution=[],
            upcoming_deadlines=[],
            recent_activities=[],
            weekly_trends=[
                WeeklyTrendItem(day=(now - timedelta(days=i)).strftime("%a"), completed=0, created=0)
                for i in reversed(range(7))
            ],
        )

    # 2. Base task match filter
    task_match: Dict[str, Any] = {}
    if current_user.role not in [UserRole.OWNER, UserRole.ADMIN]:
        task_match["project_id"] = {"$in": accessible_project_ids}

    # 3. High-Performance MongoDB $facet Aggregation Pipeline
    pipeline = [
        {"$match": task_match},
        {
            "$facet": {
                # A: Summary counts
                "summary": [
                    {
                        "$group": {
                            "_id": None,
                            "total": {"$sum": 1},
                            "completed": {
                                "$sum": {
                                    "$cond": [{"$eq": ["$status", TaskStatus.COMPLETED.value]}, 1, 0]
                                }
                            },
                            "in_progress": {
                                "$sum": {
                                    "$cond": [
                                        {"$in": ["$status", [TaskStatus.IN_PROGRESS.value, TaskStatus.IN_REVIEW.value]]},
                                        1,
                                        0,
                                    ]
                                }
                            },
                            "overdue": {
                                "$sum": {
                                    "$cond": [
                                        {
                                            "$and": [
                                                {"$ne": ["$status", TaskStatus.COMPLETED.value]},
                                                {"$lt": ["$due_date", now]},
                                                {"$ne": ["$due_date", None]},
                                            ]
                                        },
                                        1,
                                        0,
                                    ]
                                }
                            },
                        }
                    }
                ],
                # B: Status distribution
                "by_status": [
                    {"$group": {"_id": "$status", "count": {"$sum": 1}}},
                ],
                # C: Priority distribution
                "by_priority": [
                    {"$group": {"_id": "$priority", "count": {"$sum": 1}}},
                ],
                # D: Upcoming deadlines (not completed, sorted by due date)
                "upcoming": [
                    {
                        "$match": {
                            "status": {"$ne": TaskStatus.COMPLETED.value},
                            "due_date": {"$ne": None},
                        }
                    },
                    {"$sort": {"due_date": 1}},
                    {"$limit": 5},
                ],
                # E: Recent updated tasks for activity feed
                "recent_tasks": [
                    {"$sort": {"updated_at": -1}},
                    {"$limit": 10},
                ],
            }
        },
    ]

    aggregation_result = await tasks_col.aggregate(pipeline).to_list(length=1)
    facet_data = aggregation_result[0] if aggregation_result else {}

    # Extract Summary
    summary_raw = facet_data.get("summary", [])
    total_tasks = summary_raw[0].get("total", 0) if summary_raw else 0
    completed_tasks = summary_raw[0].get("completed", 0) if summary_raw else 0
    in_progress_tasks = summary_raw[0].get("in_progress", 0) if summary_raw else 0
    overdue_tasks = summary_raw[0].get("overdue", 0) if summary_raw else 0

    completion_rate = (
        round((completed_tasks / total_tasks * 100), 1) if total_tasks > 0 else 0.0
    )

    # Extract Status Distribution
    status_counts = {item["_id"]: item["count"] for item in facet_data.get("by_status", [])}
    status_distribution = [
        DistributionItem(
            name=st.value.replace("_", " "),
            count=status_counts.get(st.value, 0),
            percentage=round(status_counts.get(st.value, 0) / total_tasks * 100, 1) if total_tasks > 0 else 0.0,
        )
        for st in TaskStatus
    ]

    # Extract Priority Distribution
    priority_counts = {item["_id"]: item["count"] for item in facet_data.get("by_priority", [])}
    priority_distribution = [
        DistributionItem(
            name=p.value,
            count=priority_counts.get(p.value, 0),
            percentage=round(priority_counts.get(p.value, 0) / total_tasks * 100, 1) if total_tasks > 0 else 0.0,
        )
        for p in TaskPriority
    ]

    # Extract Upcoming Deadlines
    upcoming_raw = facet_data.get("upcoming", [])
    upcoming_deadlines: List[UpcomingTaskItem] = []
    for t in upcoming_raw:
        task_due = t.get("due_date")
        if not task_due:
            continue
        pid = str(t.get("project_id", ""))
        if isinstance(task_due, datetime):
            task_due_cmp = task_due.replace(tzinfo=timezone.utc) if task_due.tzinfo is None else task_due
            is_past = task_due_cmp < now
        else:
            is_past = False
        upcoming_deadlines.append(
            UpcomingTaskItem(
                id=str(t["_id"]),
                title=t.get("title", "Untitled Task"),
                project_id=pid,
                project_name=project_map.get(pid, "Unknown Project"),
                priority=t.get("priority", "MEDIUM"),
                status=t.get("status", "TODO"),
                due_date=task_due,
                is_overdue=is_past,
            )
        )

    # Extract Recent Activity Feed
    recent_tasks_raw = facet_data.get("recent_tasks", [])
    recent_activities: List[ActivityItem] = []
    for t in recent_tasks_raw:
        tid = str(t["_id"])
        pid = str(t.get("project_id", ""))
        pname = project_map.get(pid, "Project")
        task_title = t.get("title", "Task")
        status_val = t.get("status", "TODO")

        activity_type = "TASK_COMPLETED" if status_val == "COMPLETED" else "TASK_UPDATED"
        activity_title = f"{task_title} was marked {status_val}"

        recent_activities.append(
            ActivityItem(
                id=f"act_{tid}_{int(t.get('updated_at', now).timestamp())}",
                type=activity_type,
                title=activity_title,
                timestamp=t.get("updated_at", now),
                user_name=t.get("assignee_name") or current_user.full_name,
                project_name=pname,
            )
        )

    # Top Projects Progress (Limit 5)
    project_progress_list: List[ProjectProgressSummary] = []
    for proj in accessible_projects[:5]:
        pid = proj["id"]
        # Fast query for task breakdown in top projects
        p_total = await tasks_col.count_documents({"project_id": pid})
        p_done = await tasks_col.count_documents({"project_id": pid, "status": TaskStatus.COMPLETED.value})
        p_prog = round((p_done / p_total * 100), 1) if p_total > 0 else 0.0

        project_progress_list.append(
            ProjectProgressSummary(
                id=pid,
                name=proj["name"],
                status=proj["status"],
                progress=p_prog,
                total_tasks=p_total,
                completed_tasks=p_done,
            )
        )

    # Weekly Trend Data (Past 7 days)
    weekly_trends: List[WeeklyTrendItem] = []
    for i in reversed(range(7)):
        target_day = now - timedelta(days=i)
        day_start = target_day.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = target_day.replace(hour=23, minute=59, second=59, microsecond=999999)

        day_completed = await tasks_col.count_documents({
            **task_match,
            "status": TaskStatus.COMPLETED.value,
            "updated_at": {"$gte": day_start, "$lte": day_end},
        })
        day_created = await tasks_col.count_documents({
            **task_match,
            "created_at": {"$gte": day_start, "$lte": day_end},
        })

        weekly_trends.append(
            WeeklyTrendItem(
                day=target_day.strftime("%a"),
                completed=day_completed,
                created=day_created,
            )
        )

    return DashboardAnalyticsResponse(
        summary=SummaryMetrics(
            total_projects=total_projects,
            total_tasks=total_tasks,
            completed_tasks=completed_tasks,
            in_progress_tasks=in_progress_tasks,
            overdue_tasks=overdue_tasks,
            overall_completion_rate=completion_rate,
        ),
        project_progress=project_progress_list,
        status_distribution=status_distribution,
        priority_distribution=priority_distribution,
        upcoming_deadlines=upcoming_deadlines,
        recent_activities=recent_activities,
        weekly_trends=weekly_trends,
    )
