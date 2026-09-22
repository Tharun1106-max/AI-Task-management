"""Pydantic schemas for task dependencies, DAG graph serialization, critical path, and project health."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# ==============================================================================
# Dependency Management Request Schemas
# ==============================================================================

class AddDependencyRequest(BaseModel):
    """Payload to establish a prerequisite dependency relationship."""
    prerequisite_id: str = Field(
        ...,
        description="The ID of the task that must be completed before the target task can begin.",
    )


# ==============================================================================
# DAG Graph Serialization Schemas
# ==============================================================================

class DependencyGraphNode(BaseModel):
    """Represents a task node in the project topological dependency graph."""
    id: str = Field(..., description="Unique task ID")
    title: str = Field(..., description="Task title")
    status: str = Field(..., description="Workflow status (TODO, IN_PROGRESS, IN_REVIEW, COMPLETED, BLOCKED)")
    priority: str = Field(..., description="Priority level (LOW, MEDIUM, HIGH, CRITICAL)")
    assignee_id: Optional[str] = Field(default=None, description="Assigned team member ID")
    assignee_name: Optional[str] = Field(default=None, description="Assignee display name")
    assignee_avatar: Optional[str] = Field(default=None, description="Assignee avatar URL")
    due_date: Optional[datetime] = Field(default=None, description="Target completion timestamp")
    dependencies: List[str] = Field(default_factory=list, description="IDs of direct prerequisite tasks")
    level: int = Field(default=0, description="Topological tier / depth in DAG hierarchy")
    duration_days: int = Field(default=1, description="Estimated or elapsed duration in days")


class DependencyGraphEdge(BaseModel):
    """Directed edge from prerequisite task (source) to dependent task (target)."""
    id: str = Field(..., description="Unique edge identifier, e.g. 'edge-source-target'")
    source: str = Field(..., description="Source prerequisite task ID")
    target: str = Field(..., description="Target dependent task ID")
    is_critical_path: bool = Field(default=False, description="Flag if this edge lies on the longest critical path")


class DependencyGraphResponse(BaseModel):
    """Complete serialized topological DAG graph of a project's tasks."""
    project_id: str
    nodes: List[DependencyGraphNode] = Field(default_factory=list)
    edges: List[DependencyGraphEdge] = Field(default_factory=list)
    critical_path_task_ids: List[str] = Field(
        default_factory=list,
        description="Ordered sequence of task IDs forming the longest critical path",
    )
    critical_path_length: int = Field(
        default=0,
        description="Total duration / task count along the critical path",
    )
    has_cycles: bool = Field(
        default=False,
        description="Integrity check confirming the graph is an acyclic DAG",
    )


# ==============================================================================
# Project Health & Algorithmic Scoring Schemas
# ==============================================================================

class HealthFactorDetail(BaseModel):
    """Breakdown for a single contributing component of the composite health score."""
    name: str
    weight: float
    raw_percentage: float
    weighted_score: float
    description: str


class HealthMetricBreakdown(BaseModel):
    """Composite health metric for a project:
    Health = (Completion% * 0.4) + (OnTimeTask% * 0.3) + (UnblockedDependency% * 0.2) + (ActivityScore * 0.1)
    """
    project_id: str
    total_health_score: float = Field(..., description="Composite health index (0.0 to 100.0)")
    health_status: str = Field(
        ...,
        description="Status category: EXCELLENT (>=80), HEALTHY (60-79), NEEDS_ATTENTION (40-59), CRITICAL (<40)",
    )
    completion_pct: float = Field(..., description="Percentage of completed tasks (Weight: 40%)")
    ontime_pct: float = Field(..., description="Percentage of tasks delivered on-schedule or not overdue (Weight: 30%)")
    unblocked_pct: float = Field(..., description="Percentage of tasks with all prerequisites resolved (Weight: 20%)")
    activity_score: float = Field(..., description="Normalized velocity and activity score over past 14 days (Weight: 10%)")
    factors: List[HealthFactorDetail] = Field(default_factory=list)
    suggestions: List[str] = Field(default_factory=list, description="AI-driven actionable recommendations")
    evaluated_at: datetime = Field(default_factory=datetime.utcnow)


# ==============================================================================
# Advanced Analytics Schemas (Cumulative Flow & Workload)
# ==============================================================================

class CumulativeFlowDataPoint(BaseModel):
    """Historical/sprint data point for cumulative flow diagram."""
    date: str
    todo: int
    in_progress: int
    in_review: int
    completed: int
    blocked: int


class MemberWorkloadItem(BaseModel):
    """Task load distribution for a team member."""
    user_id: str
    user_name: str
    avatar_url: Optional[str] = None
    total_tasks: int
    in_progress_tasks: int
    completed_tasks: int
    critical_priority_tasks: int
    workload_status: str = Field(default="BALANCED", description="OPTIMAL, BALANCED, OVERLOADED, IDLE")


class MilestoneTimelineItem(BaseModel):
    """Milestone delivery horizon marker."""
    id: str
    title: str
    status: str
    target_date: Optional[datetime] = None
    progress: float
    task_count: int


class AdvancedAnalyticsResponse(BaseModel):
    """Complete dataset powering the Advanced Analytics visualization view."""
    project_id: str
    health: HealthMetricBreakdown
    cumulative_flow: List[CumulativeFlowDataPoint] = Field(default_factory=list)
    team_workload: List[MemberWorkloadItem] = Field(default_factory=list)
    milestones: List[MilestoneTimelineItem] = Field(default_factory=list)
