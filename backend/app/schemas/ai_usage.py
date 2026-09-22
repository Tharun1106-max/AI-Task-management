"""Pydantic schemas for AI usage telemetry, token quotas, and feature breakdowns."""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class AIUsageLogItem(BaseModel):
    """Single AI generation log entry with token usage and cost metrics."""
    id: str = Field(..., description="Log ID")
    endpoint: str = Field(..., description="API feature endpoint name")
    model: str = Field(..., description="Inference model identifier")
    prompt_tokens: int = Field(default=0)
    completion_tokens: int = Field(default=0)
    total_tokens: int = Field(default=0)
    cost_usd: float = Field(default=0.0, description="Estimated inference cost in USD")
    latency_ms: Optional[int] = Field(default=None, description="Execution latency in milliseconds")
    created_at: datetime = Field(..., description="Timestamp of inference")


class FeatureUsageStat(BaseModel):
    """Aggregated statistics for a specific AI capability."""
    feature: str = Field(..., description="Feature identifier key")
    display_name: str = Field(..., description="Human-friendly feature name")
    request_count: int = Field(default=0)
    total_tokens: int = Field(default=0)
    pct_of_total: float = Field(default=0.0, description="Percentage of total token consumption (0.0 to 100.0)")


class AIUsageSummaryResponse(BaseModel):
    """Complete summary of user's AI token consumption and daily quota status."""
    total_requests: int = Field(default=0)
    total_prompt_tokens: int = Field(default=0)
    total_completion_tokens: int = Field(default=0)
    total_tokens: int = Field(default=0)
    estimated_cost_usd: float = Field(default=0.0)
    daily_tokens_used: int = Field(default=0, description="Tokens consumed during the current UTC day")
    daily_token_quota: int = Field(default=50000, description="Max daily token allowance")
    quota_used_pct: float = Field(default=0.0, description="Percentage of daily quota utilized (0.0 to 100.0)")
    feature_breakdown: List[FeatureUsageStat] = Field(default_factory=list)
    recent_logs: List[AIUsageLogItem] = Field(default_factory=list)
