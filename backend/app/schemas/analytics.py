"""Pydantic schemas for Executive Analytics and Dashboard Aggregations."""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class SummaryMetrics(BaseModel):
    """Key platform health and delivery indicators."""

    total_projects: int = Field(..., description="Total active user accessible projects")
    total_tasks: int = Field(..., description="Total task backlog count")
    completed_tasks: int = Field(..., description="Tasks in COMPLETED status")
    in_progress_tasks: int = Field(..., description="Tasks actively in development")
    overdue_tasks: int = Field(..., description="Incomplete tasks past their target due date")
    overall_completion_rate: float = Field(..., description="Percentage of completed tasks (0 - 100)")


class ProjectProgressSummary(BaseModel):
    """Active project progress and task throughput summary."""

    id: str = Field(..., description="Project ID")
    name: str = Field(..., description="Project title")
    status: str = Field(..., description="Project lifecycle status")
    progress: float = Field(..., description="Project completion progress percentage")
    total_tasks: int = Field(..., description="Total tasks in project")
    completed_tasks: int = Field(..., description="Completed tasks count")


class DistributionItem(BaseModel):
    """Categorical count and percentage representation for charts."""

    name: str = Field(..., description="Category label")
    count: int = Field(..., description="Frequency count")
    percentage: float = Field(..., description="Proportional share percentage")


class UpcomingTaskItem(BaseModel):
    """High-priority deadline tracker item."""

    id: str = Field(..., description="Task ID")
    title: str = Field(..., description="Task title")
    project_id: str = Field(..., description="Parent project ID")
    project_name: str = Field(..., description="Parent project display name")
    priority: str = Field(..., description="Priority classification")
    status: str = Field(..., description="Workflow status")
    due_date: datetime = Field(..., description="Target completion deadline")
    is_overdue: bool = Field(..., description="Flag indicating deadline has passed")


class ActivityItem(BaseModel):
    """Chronological team audit event item."""

    id: str = Field(..., description="Event unique ID")
    type: str = Field(..., description="Event action classification")
    title: str = Field(..., description="Descriptive event statement")
    timestamp: datetime = Field(..., description="Event timestamp")
    user_name: str = Field(..., description="Actor user display name")
    project_name: Optional[str] = Field(default=None, description="Associated project title")


class WeeklyTrendItem(BaseModel):
    """Weekly task velocity trend for AreaChart."""
    day: str = Field(..., description="Day label (e.g. Mon, Tue, etc.)")
    completed: int = Field(..., description="Tasks completed on this day")
    created: int = Field(..., description="Tasks created on this day")


class DashboardAnalyticsResponse(BaseModel):
    """Consolidated payload driving the Executive Analytics Dashboard."""

    summary: SummaryMetrics = Field(..., description="Executive KPI metrics")
    project_progress: List[ProjectProgressSummary] = Field(..., description="Top active projects progress")
    status_distribution: List[DistributionItem] = Field(..., description="Tasks grouped by workflow status")
    priority_distribution: List[DistributionItem] = Field(..., description="Tasks grouped by priority")
    upcoming_deadlines: List[UpcomingTaskItem] = Field(..., description="Tasks nearing deadlines")
    recent_activities: List[ActivityItem] = Field(..., description="Recent activity audit timeline")
    weekly_trends: List[WeeklyTrendItem] = Field(..., description="7-day completion and creation velocity")
