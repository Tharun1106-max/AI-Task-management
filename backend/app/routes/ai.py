"""FastAPI router for Google Gemini AI endpoints: project planning, task decomposition, prioritization, and executive summaries."""

from datetime import datetime, timezone
import logging
from typing import Any, Dict, List
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from app.database.mongodb import db_manager
from app.models.user import User
from app.routes.notifications import log_activity
from app.schemas.ai import (
    ApplyPlanRequest,
    ApplyPlanResponse,
    ApplyRiskFixRequest,
    ApplyRiskFixResponse,
    AssistantRequest,
    AssistantResponse,
    GenerateTasksRequest,
    GenerateTasksResponse,
    MeetingNotesRequest,
    MeetingNotesResponse,
    PrioritizeRequest,
    PrioritizeResponse,
    ProjectPlanRequest,
    ProjectPlanResponse,
    RiskAnalysisRequest,
    RiskAnalysisResponse,
    SummarizeProjectRequest,
    SummarizeProjectResponse,
)
from app.services.ai_service import ai_service
from app.services.risk_service import risk_service
from app.utils.security import get_current_user

logger = logging.getLogger("taskpilot.ai_router")

router = APIRouter(tags=["AI"])


@router.post(
    "/project-plan",
    response_model=ProjectPlanResponse,
    summary="Synthesize Full Project Plan",
    description="Decompose a product idea into phased milestones, recommended tasks, and dependencies using Google Gemini.",
)
async def create_project_plan(
    payload: ProjectPlanRequest,
    current_user: User = Depends(get_current_user),
) -> ProjectPlanResponse:
    """Generate structured project roadmap with strict Pydantic JSON validation."""
    logger.info("User [%s] requested AI project plan for domain [%s]", current_user.email, payload.domain)
    plan = await ai_service.generate_project_plan(
        idea_prompt=payload.idea_prompt,
        domain=payload.domain or "Software Engineering",
        duration_weeks=payload.estimated_duration_weeks or 4,
        user_id=current_user.id,
    )
    return plan


@router.post(
    "/generate-tasks",
    response_model=GenerateTasksResponse,
    summary="Quick Task Decomposition",
    description="Generate 5-10 granular, actionable tasks for a specific feature or user story.",
)
async def generate_tasks(
    payload: GenerateTasksRequest,
    current_user: User = Depends(get_current_user),
) -> GenerateTasksResponse:
    """Generate granular task cards ready to be batched into the workspace."""
    logger.info("User [%s] generating tasks for prompt: %s", current_user.email, payload.prompt[:30])
    response = await ai_service.generate_tasks(
        prompt=payload.prompt,
        project_context=payload.project_context,
        count=payload.count or 6,
        user_id=current_user.id,
    )
    return response


@router.post(
    "/prioritize",
    response_model=PrioritizeResponse,
    summary="AI Task Prioritization & Bottleneck Analysis",
    description="Evaluate project backlog to rank tasks by urgency, blockers, and milestone risk.",
)
async def prioritize_tasks(
    payload: PrioritizeRequest,
    current_user: User = Depends(get_current_user),
) -> PrioritizeResponse:
    """Evaluate and rank tasks with reasoning tooltips and tags."""
    db = db_manager.get_database()
    tasks_to_evaluate: List[Dict[str, Any]] = []

    # 1. Fetch tasks by task_ids if provided
    if payload.task_ids:
        valid_oids = [ObjectId(tid) for tid in payload.task_ids if ObjectId.is_valid(tid)]
        if valid_oids:
            cursor = db.tasks.find({"_id": {"$in": valid_oids}})
            tasks_to_evaluate = await cursor.to_list(length=100)

    # 2. Or fetch all uncompleted tasks for project_id
    elif payload.project_id:
        query: Dict[str, Any] = {"status": {"$ne": "COMPLETED"}}
        if ObjectId.is_valid(payload.project_id):
            query["project_id"] = ObjectId(payload.project_id)
        else:
            query["project_id"] = payload.project_id
        cursor = db.tasks.find(query).limit(50)
        tasks_to_evaluate = await cursor.to_list(length=50)

    # Convert ObjectId to string for JSON serialization
    for t in tasks_to_evaluate:
        t["id"] = str(t["_id"])

    response = await ai_service.prioritize_tasks(
        tasks=tasks_to_evaluate,
        bottlenecks=payload.current_bottlenecks,
        target_deadline=payload.target_deadline,
        user_id=current_user.id,
    )
    return response


@router.post(
    "/summarize",
    response_model=SummarizeProjectResponse,
    summary="Executive Project Status Briefing",
    description="Generate a high-level briefing summarizing wins, current bottlenecks, and health score.",
)
async def summarize_project(
    payload: SummarizeProjectRequest,
    current_user: User = Depends(get_current_user),
) -> SummarizeProjectResponse:
    """Synthesize an executive briefing for a project."""
    db = db_manager.get_database()

    # Find project
    p_query: Dict[str, Any] = {}
    if ObjectId.is_valid(payload.project_id):
        p_query["_id"] = ObjectId(payload.project_id)
    else:
        p_query["_id"] = payload.project_id

    project = await db.projects.find_one(p_query)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found.",
        )

    # Find project tasks
    t_query: Dict[str, Any] = {}
    if ObjectId.is_valid(payload.project_id):
        t_query["project_id"] = ObjectId(payload.project_id)
    else:
        t_query["project_id"] = payload.project_id

    tasks = await db.tasks.find(t_query).to_list(length=200)

    response = await ai_service.summarize_project(
        project=project,
        tasks=tasks,
        user_id=current_user.id,
    )
    return response


@router.post(
    "/apply-plan",
    response_model=ApplyPlanResponse,
    summary="Apply Generated Plan to Project",
    description="Batch creates project (if needed) and inserts all selected generated tasks into the workspace.",
)
async def apply_plan(
    payload: ApplyPlanRequest,
    current_user: User = Depends(get_current_user),
) -> ApplyPlanResponse:
    """Persist the approved AI plan directly into MongoDB."""
    db = db_manager.get_database()
    now = datetime.now(timezone.utc)
    target_project_id = payload.project_id

    # 1. Create new project if not attaching to existing
    if not target_project_id:
        p_name = payload.project_name or "AI Generated Project"
        p_desc = payload.project_description or "Project plan generated via TaskPilot AI."
        proj_doc = {
            "name": p_name,
            "description": p_desc,
            "owner_id": str(current_user.id),
            "member_ids": [str(current_user.id)],
            "status": "PLANNING",
            "progress": 0.0,
            "tags": payload.tags or ["ai-generated"],
            "created_at": now,
            "updated_at": now,
        }
        res = await db.projects.insert_one(proj_doc)
        target_project_id = str(res.inserted_id)

        await log_activity(
            user_id=current_user.id,
            user_name=current_user.full_name,
            action="PROJECT_CREATED",
            description=f"Created project '{p_name}' via AI Planner",
            project_id=target_project_id,
            project_name=p_name,
        )
    else:
        # Verify target project exists
        p_query = {"_id": ObjectId(target_project_id) if ObjectId.is_valid(target_project_id) else target_project_id}
        existing_proj = await db.projects.find_one(p_query)
        if not existing_proj:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target project not found.")

    # 2. Batch insert selected tasks
    created_count = 0
    if payload.tasks:
        task_docs = []
        for t in payload.tasks:
            due_dt = None
            if t.due_date:
                try:
                    due_dt = datetime.fromisoformat(t.due_date)
                except Exception:
                    due_dt = None

            doc = {
                "title": t.title,
                "description": t.description or "",
                "project_id": str(target_project_id),
                "assignee_id": str(current_user.id),
                "status": "TODO",
                "priority": t.priority if t.priority in ["LOW", "MEDIUM", "HIGH", "CRITICAL"] else "MEDIUM",
                "due_date": due_dt,
                "dependencies": [],
                "tags": t.tags or [],
                "comments": [],
                "attachments": [],
                "created_at": now,
                "updated_at": now,
            }
            task_docs.append(doc)

        if task_docs:
            insert_res = await db.tasks.insert_many(task_docs)
            created_count = len(insert_res.inserted_ids)

        await log_activity(
            user_id=current_user.id,
            user_name=current_user.full_name,
            action="TASK_CREATED",
            description=f"Batch created {created_count} AI tasks",
            project_id=target_project_id,
            project_name=payload.project_name if not payload.project_id else None,
        )

    return ApplyPlanResponse(
        success=True,
        project_id=target_project_id,
        created_tasks_count=created_count,
        message=f"Successfully applied plan with {created_count} tasks initialized.",
    )


# ==============================================================================
# Risk Detection & Remediation
# ==============================================================================

@router.post(
    "/risk-analysis",
    response_model=RiskAnalysisResponse,
    summary="Project Risk Detection Engine",
    description="Evaluates project delivery risks across bottlenecks, deadline slippage, and resource overload.",
)
async def analyze_project_risks(
    payload: RiskAnalysisRequest,
    current_user: User = Depends(get_current_user),
) -> RiskAnalysisResponse:
    """Evaluate live project risks with AI reasoning."""
    return await risk_service.analyze_project_risks(payload.project_id, current_user.id)


@router.post(
    "/risk-fix",
    response_model=ApplyRiskFixResponse,
    summary="One-Click Risk Remediation",
    description="Executes automated remediation on tasks affected by an identified risk vector.",
)
async def apply_risk_fix(
    payload: ApplyRiskFixRequest,
    current_user: User = Depends(get_current_user),
) -> ApplyRiskFixResponse:
    """Execute automated one-click fix for project risk."""
    return await risk_service.apply_risk_fix(
        project_id=payload.project_id,
        risk_id=payload.risk_id,
        fix_type=payload.fix_type,
        task_ids=payload.task_ids,
        user_id=current_user.id,
    )


# ==============================================================================
# Context-Aware Project Assistant (Copilot)
# ==============================================================================

@router.post(
    "/assistant",
    response_model=AssistantResponse,
    summary="Context-Aware Project Copilot",
    description="Conversational project assistant with live MongoDB project state injection.",
)
async def ask_project_assistant(
    payload: AssistantRequest,
    current_user: User = Depends(get_current_user),
) -> AssistantResponse:
    """Chat with context-aware project assistant."""
    return await risk_service.ask_project_assistant(
        message=payload.message,
        project_id=payload.project_id,
        history=payload.history,
        user_id=current_user.id,
    )


# ==============================================================================
# Meeting Notes & Transcript to Tasks
# ==============================================================================

@router.post(
    "/meeting-notes-to-tasks",
    response_model=MeetingNotesResponse,
    summary="Extract Decisions and Tasks from Meeting Notes",
    description="Parses raw meeting notes into executive summary, key decisions, and draft task action items.",
)
async def convert_meeting_notes_to_tasks(
    payload: MeetingNotesRequest,
    current_user: User = Depends(get_current_user),
) -> MeetingNotesResponse:
    """Decompose meeting transcript into summary and actionable tasks."""
    return await risk_service.convert_meeting_notes(
        raw_text=payload.raw_text,
        project_id=payload.project_id,
        user_id=current_user.id,
    )

