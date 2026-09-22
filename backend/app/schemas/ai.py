"""Pydantic schemas for Google Gemini AI endpoints and generation payloads."""

from typing import List, Optional
from pydantic import BaseModel, Field


# ==============================================================================
# Token Usage & Telemetry
# ==============================================================================

class TokenUsage(BaseModel):
    """Token consumption telemetry."""
    prompt_tokens: int = Field(default=0, description="Tokens evaluated in prompt")
    completion_tokens: int = Field(default=0, description="Tokens produced in generation")
    total_tokens: int = Field(default=0, description="Total consumed tokens")
    model: str = Field(default="", description="Model used for synthesis")


# ==============================================================================
# Project Plan Schemas
# ==============================================================================

class ProjectPlanRequest(BaseModel):
    """Payload to synthesize a full project roadmap."""
    idea_prompt: str = Field(
        ...,
        min_length=5,
        max_length=2000,
        description="High-level project concept, user story, or business goal",
    )
    domain: Optional[str] = Field(
        default="Software Engineering",
        description="Industry or technical domain (e.g. Fintech, E-Commerce, Healthcare, SaaS)",
    )
    estimated_duration_weeks: Optional[int] = Field(
        default=4,
        ge=1,
        le=52,
        description="Estimated project delivery timeframe in weeks",
    )


class PlanMilestone(BaseModel):
    """Generated milestone stage."""
    id: str = Field(..., description="Milestone identifier (e.g. m1, m2)")
    title: str = Field(..., description="Milestone title")
    description: str = Field(..., description="Scope and deliverables of this milestone")
    target_week: int = Field(..., ge=1, description="Target completion week")


class PlanTask(BaseModel):
    """Generated granular task recommendation."""
    id: str = Field(..., description="Task identifier (e.g. t1, t2)")
    title: str = Field(..., description="Task title")
    description: str = Field(..., description="Detailed instructions and acceptance criteria")
    milestone_id: Optional[str] = Field(default=None, description="Linked milestone ID")
    priority: str = Field(default="MEDIUM", description="Task priority (LOW, MEDIUM, HIGH, CRITICAL)")
    estimated_days: int = Field(default=2, ge=1, description="Estimated effort in business days")
    dependencies: List[str] = Field(default_factory=list, description="IDs of preceding tasks")
    tags: List[str] = Field(default_factory=list, description="Domain and technical tags")


class ProjectPlanResponse(BaseModel):
    """Structured response containing synthesized plan."""
    title: str = Field(..., description="Recommended project title")
    description: str = Field(..., description="Executive project overview and scope statement")
    suggested_tags: List[str] = Field(default_factory=list, description="Top-level project categorization tags")
    milestones: List[PlanMilestone] = Field(default_factory=list, description="Phased milestones")
    tasks: List[PlanTask] = Field(default_factory=list, description="Actionable recommended tasks")
    token_usage: Optional[TokenUsage] = Field(default=None, description="LLM execution telemetry")


# ==============================================================================
# Task Quick-Generation Schemas
# ==============================================================================

class GenerateTasksRequest(BaseModel):
    """Payload to generate granular tasks for a specific feature or topic."""
    prompt: str = Field(..., min_length=3, max_length=1500, description="Feature topic or user story")
    project_id: Optional[str] = Field(default=None, description="Optional target project ID")
    project_context: Optional[str] = Field(default=None, description="High-level project scope or tech stack")
    count: Optional[int] = Field(default=6, ge=1, le=15, description="Number of tasks to generate")


class GeneratedTaskItem(BaseModel):
    """Single decomposed task."""
    title: str = Field(..., description="Task title")
    description: str = Field(..., description="Task description and acceptance criteria")
    priority: str = Field(default="MEDIUM", description="Priority level (LOW, MEDIUM, HIGH, CRITICAL)")
    tags: List[str] = Field(default_factory=list, description="Categorization tags")
    estimated_hours: Optional[int] = Field(default=4, ge=1, description="Estimated work hours")


class GenerateTasksResponse(BaseModel):
    """Response containing decomposed task list."""
    tasks: List[GeneratedTaskItem] = Field(default_factory=list, description="Generated tasks")
    token_usage: Optional[TokenUsage] = Field(default=None, description="LLM execution telemetry")


# ==============================================================================
# Task Prioritization Schemas
# ==============================================================================

class PrioritizeRequest(BaseModel):
    """Payload to evaluate and rank tasks by urgency, blockers, and bottlenecks."""
    project_id: Optional[str] = Field(default=None, description="Target project ID")
    task_ids: Optional[List[str]] = Field(default=None, description="Specific task IDs to analyze")
    current_bottlenecks: Optional[str] = Field(default=None, description="Known blockers or resourcing constraints")
    target_deadline: Optional[str] = Field(default=None, description="Upcoming target delivery date")


class PrioritizedTaskItem(BaseModel):
    """Task evaluated with ranking and rationale."""
    task_id: str = Field(..., description="Target task ID")
    title: str = Field(..., description="Task title")
    recommended_priority: str = Field(..., description="Recommended priority (LOW, MEDIUM, HIGH, CRITICAL)")
    urgency_rank: int = Field(..., ge=1, description="1 is highest urgency")
    category_tag: str = Field(..., description="Category: 'Urgent Blocker', 'Approaching Deadline', or 'Low Impact'")
    rationale: str = Field(..., description="AI reasoning explaining urgency, blockers, or workload impact")


class PrioritizeResponse(BaseModel):
    """Response containing ranked tasks and strategic summary."""
    ranked_tasks: List[PrioritizedTaskItem] = Field(default_factory=list, description="Prioritized task rankings")
    strategic_advice: str = Field(..., description="Actionable execution guidance for the team lead")
    token_usage: Optional[TokenUsage] = Field(default=None, description="LLM execution telemetry")


# ==============================================================================
# Executive Project Summarization Schemas
# ==============================================================================

class SummarizeProjectRequest(BaseModel):
    """Payload to summarize project status and risks."""
    project_id: str = Field(..., description="Project ID to summarize")


class SummarizeProjectResponse(BaseModel):
    """Executive project briefing."""
    project_title: str = Field(..., description="Project title")
    executive_summary: str = Field(..., description="High-level state of the project")
    completed_wins: List[str] = Field(default_factory=list, description="Recent achievements and completed items")
    current_roadblocks: List[str] = Field(default_factory=list, description="Active blockers, delays, or risk factors")
    next_recommended_actions: List[str] = Field(default_factory=list, description="Top 3-5 next tactical steps")
    health_score: int = Field(default=85, ge=0, le=100, description="Project health score (0-100)")
    token_usage: Optional[TokenUsage] = Field(default=None, description="LLM execution telemetry")


# ==============================================================================
# Apply Plan Directly to Database
# ==============================================================================

class ApplyPlanTask(BaseModel):
    """Task to persist into database from generated plan."""
    title: str = Field(..., min_length=1)
    description: Optional[str] = Field(default=None)
    priority: str = Field(default="MEDIUM")
    due_date: Optional[str] = Field(default=None)
    tags: List[str] = Field(default_factory=list)


class ApplyPlanRequest(BaseModel):
    """Payload to persist generated plan into MongoDB as project and tasks."""
    project_id: Optional[str] = Field(default=None, description="Existing project ID, or None to create new")
    project_name: Optional[str] = Field(default=None, description="Name for newly created project")
    project_description: Optional[str] = Field(default=None, description="Description for newly created project")
    tags: List[str] = Field(default_factory=list)
    tasks: List[ApplyPlanTask] = Field(default_factory=list, description="Tasks to batch-insert")


class ApplyPlanResponse(BaseModel):
    """Result of applying the plan."""
    success: bool = True
    project_id: str
    created_tasks_count: int
    message: str


# ==============================================================================
# AI Risk Engine Schemas
# ==============================================================================

class RiskAnalysisRequest(BaseModel):
    """Request to evaluate project risks."""
    project_id: str = Field(..., description="Target project ID to analyze")


class IdentifiedRiskItem(BaseModel):
    """Specific risk vector detected by the AI engine."""
    id: str = Field(..., description="Unique risk identifier (e.g. risk_1)")
    title: str = Field(..., description="Short risk title")
    description: str = Field(..., description="Detailed explanation of risk condition")
    severity: str = Field(default="MEDIUM", description="Severity: LOW, MEDIUM, HIGH, CRITICAL")
    risk_category: str = Field(default="BOTTLENECK", description="Category: BOTTLENECK, DEADLINE_SLIPPAGE, RESOURCE_OVERLOAD")
    affected_task_ids: List[str] = Field(default_factory=list, description="IDs of affected tasks")
    affected_task_titles: List[str] = Field(default_factory=list, description="Titles of affected tasks")
    suggested_action: str = Field(..., description="Recommended remediation action")
    one_click_fix_type: Optional[str] = Field(
        default=None,
        description="Type of automated remediation: AUTO_REASSIGN, ESCALATE_PRIORITY, CLEAR_BLOCKER, EXTEND_DEADLINE",
    )


class RiskAnalysisResponse(BaseModel):
    """Comprehensive project risk evaluation report."""
    project_id: str
    overall_risk_score: int = Field(default=25, ge=0, le=100, description="Overall risk index (0=safe, 100=critical)")
    risk_level: str = Field(default="LOW", description="LOW (0-30), MEDIUM (31-65), HIGH (66-85), CRITICAL (86-100)")
    summary_assessment: str = Field(..., description="Executive risk assessment narrative")
    identified_risks: List[IdentifiedRiskItem] = Field(default_factory=list, description="List of detected risks")
    metrics_snapshot: Optional[dict] = Field(default=None, description="Snapshot of underlying task numbers analyzed")
    token_usage: Optional[TokenUsage] = Field(default=None, description="LLM execution telemetry")


class ApplyRiskFixRequest(BaseModel):
    """Request to execute one-click automated remediation for an identified risk."""
    project_id: str = Field(..., description="Target project ID")
    risk_id: str = Field(..., description="Target risk identifier")
    fix_type: str = Field(..., description="Action type: AUTO_REASSIGN, ESCALATE_PRIORITY, CLEAR_BLOCKER")
    task_ids: List[str] = Field(default_factory=list, description="IDs of tasks to modify")


class ApplyRiskFixResponse(BaseModel):
    """Response of automated remediation action."""
    success: bool = True
    message: str
    updated_tasks_count: int


# ==============================================================================
# Context-Aware Project Assistant (Copilot) Schemas
# ==============================================================================

class AssistantMessage(BaseModel):
    """Conversation turn in assistant chat."""
    role: str = Field(..., description="'user' or 'assistant'")
    content: str = Field(..., description="Message content")


class ReferencedTask(BaseModel):
    """Interactive task reference card embedded inside assistant response."""
    id: str = Field(..., description="Task ID")
    title: str = Field(..., description="Task title")
    status: str = Field(default="TODO")
    priority: str = Field(default="MEDIUM")


class AssistantRequest(BaseModel):
    """User query sent to context-aware project assistant."""
    message: str = Field(..., min_length=1, max_length=2000, description="User question or instruction")
    project_id: Optional[str] = Field(default=None, description="Current project context ID")
    history: Optional[List[AssistantMessage]] = Field(default_factory=list, description="Recent conversation turns")


class AssistantResponse(BaseModel):
    """Context-aware assistant response."""
    answer: str = Field(..., description="Markdown-formatted conversational response")
    referenced_tasks: List[ReferencedTask] = Field(default_factory=list, description="Tasks referenced in context")
    suggested_followups: List[str] = Field(default_factory=list, description="Smart follow-up prompt pills")
    token_usage: Optional[TokenUsage] = Field(default=None, description="LLM execution telemetry")


# ==============================================================================
# Meeting Notes to Tasks Schemas
# ==============================================================================

class MeetingNotesRequest(BaseModel):
    """Raw meeting notes or transcript payload."""
    raw_text: str = Field(..., min_length=10, max_length=20000, description="Meeting notes text")
    project_id: Optional[str] = Field(default=None, description="Target project ID to attach extracted tasks")


class MeetingActionItem(BaseModel):
    """Single action item extracted from meeting notes."""
    title: str = Field(..., description="Task title")
    description: str = Field(..., description="Context and acceptance criteria")
    priority: str = Field(default="MEDIUM", description="Task priority (LOW, MEDIUM, HIGH, CRITICAL)")
    suggested_assignee: Optional[str] = Field(default=None, description="Suggested assignee name or role")
    due_date: Optional[str] = Field(default=None, description="Target due date string or None")
    tags: List[str] = Field(default_factory=list, description="Categorization tags")


class MeetingNotesResponse(BaseModel):
    """Structured extraction of decisions and tasks from meeting notes."""
    meeting_title: str = Field(..., description="Extracted meeting subject or topic")
    summary: str = Field(..., description="Executive synopsis of meeting discussion")
    key_decisions: List[str] = Field(default_factory=list, description="List of agreed architectural or business decisions")
    action_items: List[MeetingActionItem] = Field(default_factory=list, description="Draft tasks extracted from transcript")
    token_usage: Optional[TokenUsage] = Field(default=None, description="LLM execution telemetry")

