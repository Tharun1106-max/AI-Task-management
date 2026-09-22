"""FastAPI router for task dependencies, topological DAG serialization, and project health."""

from datetime import datetime, timezone
import logging
from typing import Any, Dict, List
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.database.mongodb import get_collection
from app.models.task import TaskInDB
from app.models.user import UserInDB, UserRole
from app.routes.notifications import log_activity
from app.routes.projects import calculate_project_metrics, get_project_or_404, verify_project_membership
from app.routes.tasks import enrich_task_response
from app.schemas.dependency import (
    AddDependencyRequest,
    AdvancedAnalyticsResponse,
    DependencyGraphResponse,
    HealthMetricBreakdown,
)
from app.schemas.task import TaskResponse
from app.services.graph_service import graph_service
from app.utils.security import get_current_user

logger = logging.getLogger("taskpilot.dependencies_router")

router = APIRouter(tags=["Task Dependencies & Project Health"])


# ==============================================================================
# Dependency Management Endpoints
# ==============================================================================

@router.post(
    "/tasks/{id}/dependencies",
    response_model=TaskResponse,
    summary="Add Prerequisite Task Dependency",
    description="Adds a prerequisite task with cycle detection (Tarjan/Kahn algorithm). Rejects circular dependencies with 400 Bad Request.",
)
async def add_task_dependency(
    id: str,
    payload: AddDependencyRequest,
    current_user: UserInDB = Depends(get_current_user),
) -> TaskResponse:
    """Adds a prerequisite task while preventing cyclic graphs."""
    tasks_col = get_collection("tasks")

    query_target = {"_id": ObjectId(id)} if ObjectId.is_valid(id) else {"_id": id}
    target_doc = await tasks_col.find_one(query_target)
    if not target_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Target task '{id}' was not found.",
        )

    target_task = TaskInDB.from_mongo(target_doc)
    project = await get_project_or_404(target_task.project_id)
    verify_project_membership(project, current_user)

    prereq_id = payload.prerequisite_id.strip()
    if prereq_id == target_task.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Circular dependency detected",
        )

    query_prereq = {"_id": ObjectId(prereq_id)} if ObjectId.is_valid(prereq_id) else {"_id": prereq_id}
    prereq_doc = await tasks_col.find_one(query_prereq)
    if not prereq_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Prerequisite task '{prereq_id}' was not found.",
        )

    prereq_task = TaskInDB.from_mongo(prereq_doc)
    if prereq_task.project_id != target_task.project_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Prerequisite task must belong to the same project.",
        )

    # Check if already added
    current_deps = target_task.dependencies or []
    if prereq_id in current_deps:
        return await enrich_task_response(target_task)

    # 1. Fetch all existing dependencies across the project for cycle detection
    cursor = tasks_col.find(
        {"project_id": target_task.project_id},
        {"_id": 1, "dependencies": 1},
    )
    all_project_deps: Dict[str, List[str]] = {}
    async for t in cursor:
        all_project_deps[str(t["_id"])] = t.get("dependencies", []) or []

    # 2. Run Algorithmic Cycle Detection
    is_circular = graph_service.would_cause_cycle(
        existing_dependencies=all_project_deps,
        target_task_id=target_task.id,
        new_prerequisite_id=prereq_id,
    )

    if is_circular:
        logger.warning(
            "Cycle rejected: Adding prerequisite '%s' -> target '%s' in project '%s'",
            prereq_id,
            target_task.id,
            project.name,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Circular dependency detected",
        )

    # 3. Commit dependency update to database
    updated_deps = list(set(current_deps + [prereq_id]))
    now = datetime.now(timezone.utc)

    await tasks_col.update_one(
        query_target,
        {
            "$set": {
                "dependencies": updated_deps,
                "updated_at": now,
            }
        },
    )

    # Refresh project metrics
    await calculate_project_metrics(project.id)

    # Log activity
    await log_activity(
        user_id=current_user.id,
        user_name=current_user.full_name,
        action="TASK_DEPENDENCY_ADDED",
        description=f"Added '{prereq_task.title}' as prerequisite for '{target_task.title}'",
        project_id=project.id,
        project_name=project.name,
    )

    updated_doc = await tasks_col.find_one(query_target)
    return await enrich_task_response(TaskInDB.from_mongo(updated_doc))


@router.delete(
    "/tasks/{id}/dependencies/{dep_id}",
    response_model=TaskResponse,
    summary="Remove Prerequisite Task Dependency",
    description="Removes a prerequisite relationship from a task.",
)
async def remove_task_dependency(
    id: str,
    dep_id: str,
    current_user: UserInDB = Depends(get_current_user),
) -> TaskResponse:
    """Removes a prerequisite dependency."""
    tasks_col = get_collection("tasks")

    query = {"_id": ObjectId(id)} if ObjectId.is_valid(id) else {"_id": id}
    target_doc = await tasks_col.find_one(query)
    if not target_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task '{id}' was not found.",
        )

    target_task = TaskInDB.from_mongo(target_doc)
    project = await get_project_or_404(target_task.project_id)
    verify_project_membership(project, current_user)

    current_deps = target_task.dependencies or []
    updated_deps = [d for d in current_deps if d != dep_id]

    now = datetime.now(timezone.utc)
    await tasks_col.update_one(
        query,
        {
            "$set": {
                "dependencies": updated_deps,
                "updated_at": now,
            }
        },
    )

    await calculate_project_metrics(project.id)

    updated_doc = await tasks_col.find_one(query)
    return await enrich_task_response(TaskInDB.from_mongo(updated_doc))


# ==============================================================================
# DAG Serialization & Critical Path Endpoint
# ==============================================================================

@router.get(
    "/projects/{id}/dependency-graph",
    response_model=DependencyGraphResponse,
    summary="Get Project DAG Dependency Graph & Critical Path",
    description="Returns serialized nodes, directed edges, and calculated critical path (longest dependent path).",
)
async def get_project_dependency_graph(
    id: str,
    current_user: UserInDB = Depends(get_current_user),
) -> DependencyGraphResponse:
    """Calculates and returns the project's DAG structure with critical path identification."""
    project = await get_project_or_404(id)
    verify_project_membership(project, current_user)

    tasks_col = get_collection("tasks")
    users_col = get_collection("users")

    cursor = tasks_col.find({"project_id": project.id})
    tasks = await cursor.to_list(length=1000)

    # Fetch referenced assignee user records
    user_ids = list({str(t.get("assignee_id")) for t in tasks if t.get("assignee_id")})
    users_map: Dict[str, Dict[str, Any]] = {}
    if user_ids:
        obj_ids = [ObjectId(uid) for uid in user_ids if ObjectId.is_valid(uid)]
        u_cursor = users_col.find({"_id": {"$in": obj_ids}})
        async for u in u_cursor:
            users_map[str(u["_id"])] = {
                "full_name": u.get("full_name", "Team Member"),
                "avatar_url": u.get("avatar_url"),
            }

    return graph_service.serialize_project_dag(
        project_id=project.id,
        tasks=tasks,
        users_map=users_map,
    )


# ==============================================================================
# Project Health Metric Endpoint
# ==============================================================================

@router.get(
    "/projects/{id}/health",
    response_model=HealthMetricBreakdown,
    summary="Get Project Health Metric Breakdown",
    description="Computes composite health score: Health = (Completion% * 0.4) + (OnTimeTask% * 0.3) + (UnblockedDependency% * 0.2) + (ActivityScore * 0.1).",
)
async def get_project_health(
    id: str,
    current_user: UserInDB = Depends(get_current_user),
) -> HealthMetricBreakdown:
    """Calculates composite algorithmic health score and recommendations."""
    project = await get_project_or_404(id)
    verify_project_membership(project, current_user)

    return await graph_service.calculate_project_health(project.id)


# ==============================================================================
# Advanced Analytics Endpoint (Flow, Workload & Milestones)
# ==============================================================================

@router.get(
    "/projects/{id}/advanced-metrics",
    response_model=AdvancedAnalyticsResponse,
    summary="Get Advanced Project Analytics",
    description="Returns cumulative flow diagram data, team workload distribution, and milestone horizons.",
)
async def get_advanced_project_metrics(
    id: str,
    current_user: UserInDB = Depends(get_current_user),
) -> AdvancedAnalyticsResponse:
    """Fetches high-resolution velocity, cumulative flow, and workload metrics."""
    project = await get_project_or_404(id)
    verify_project_membership(project, current_user)

    return await graph_service.get_advanced_analytics(project.id)
