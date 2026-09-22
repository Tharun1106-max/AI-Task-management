"""FastAPI router for AI usage telemetry, token quotas, and cost aggregation."""

from datetime import datetime, timezone
import logging
from typing import Any, Dict, List
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from app.config import get_settings
from app.database.mongodb import db_manager
from app.models.user import UserInDB, UserRole
from app.schemas.ai_usage import (
    AIUsageLogItem,
    AIUsageSummaryResponse,
    FeatureUsageStat,
)
from app.utils.security import get_current_user

logger = logging.getLogger("taskpilot.ai_usage")
settings = get_settings()

router = APIRouter(prefix="", tags=["AI Usage & Billing"])

# Friendly feature display names
FEATURE_NAMES: Dict[str, str] = {
    "project-plan": "Project Planner",
    "generate-tasks": "Task Decomposition",
    "prioritize": "Task Prioritization",
    "summarize-project": "Executive Summaries",
    "risk-analysis": "Risk Detection",
    "assistant": "Context Copilot",
    "meeting-notes-to-tasks": "Meeting Notes",
    "rag-query": "Document RAG Search",
}

COST_PER_1K_TOKENS = 0.00059  # Blended rate ~$0.59 / 1M tokens for Llama 3.3


# ==============================================================================
# Daily User Quota Verification Utility
# ==============================================================================

async def check_daily_user_quota(user_id: str) -> None:
    """Verifies that the user has not exceeded their daily allocated token quota."""
    db = db_manager.get_database()
    now = datetime.now(timezone.utc)
    start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)

    pipeline = [
        {
            "$match": {
                "user_id": user_id,
                "created_at": {"$gte": start_of_day},
            }
        },
        {"$group": {"_id": None, "daily_tokens": {"$sum": "$total_tokens"}}},
    ]

    cursor = db.ai_generations.aggregate(pipeline)
    res = await cursor.to_list(length=1)
    daily_used = res[0]["daily_tokens"] if res else 0

    quota = settings.AI_DAILY_TOKEN_QUOTA
    if daily_used >= quota:
        logger.warning(
            "User [%s] exceeded daily AI token quota (%d/%d tokens).",
            user_id,
            daily_used,
            quota,
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                f"Daily AI token quota exceeded ({daily_used:,} / {quota:,} tokens). "
                "Your quota resets at 00:00 UTC. Contact your workspace administrator to increase your allocation."
            ),
        )


# ==============================================================================
# AI Usage Aggregation Endpoint
# ==============================================================================

@router.get(
    "/usage",
    response_model=AIUsageSummaryResponse,
    summary="Get User AI Token Usage & Quota Summary",
    description="Aggregates cumulative tokens consumed, daily quota utilization, estimated costs, and feature distribution.",
)
async def get_ai_usage_summary(
    current_user: UserInDB = Depends(get_current_user),
) -> AIUsageSummaryResponse:
    """Calculates AI usage telemetry across all models and features."""
    db = db_manager.get_database()
    now = datetime.now(timezone.utc)
    start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # Match user's own records (or all records if administrator)
    match_filter: Dict[str, Any] = {}
    if current_user.role not in [UserRole.OWNER, UserRole.ADMIN]:
        match_filter["user_id"] = current_user.id

    # 1. Fetch recent logs
    recent_cursor = (
        db.ai_generations.find(match_filter).sort("created_at", -1).limit(25)
    )
    recent_docs = await recent_cursor.to_list(length=25)

    recent_logs: List[AIUsageLogItem] = []
    for doc in recent_docs:
        total_tok = doc.get("total_tokens", 0)
        cost = round((total_tok / 1000.0) * COST_PER_1K_TOKENS, 5)
        recent_logs.append(
            AIUsageLogItem(
                id=str(doc["_id"]),
                endpoint=doc.get("endpoint", "unknown"),
                model=doc.get("model", "llama-3.3-70b-versatile"),
                prompt_tokens=doc.get("prompt_tokens", 0),
                completion_tokens=doc.get("completion_tokens", 0),
                total_tokens=total_tok,
                cost_usd=cost,
                latency_ms=doc.get("latency_ms"),
                created_at=doc.get("created_at", now),
            )
        )

    # 2. Cumulative totals & feature breakdown via MongoDB aggregation
    pipeline = [
        {"$match": match_filter},
        {
            "$group": {
                "_id": "$endpoint",
                "request_count": {"$sum": 1},
                "prompt_tokens": {"$sum": "$prompt_tokens"},
                "completion_tokens": {"$sum": "$completion_tokens"},
                "total_tokens": {"$sum": "$total_tokens"},
            }
        },
    ]

    cursor = db.ai_generations.aggregate(pipeline)
    feature_aggregations = await cursor.to_list(length=50)

    total_requests = 0
    total_prompt_tokens = 0
    total_completion_tokens = 0
    total_tokens = 0

    for item in feature_aggregations:
        total_requests += item.get("request_count", 0)
        total_prompt_tokens += item.get("prompt_tokens", 0)
        total_completion_tokens += item.get("completion_tokens", 0)
        total_tokens += item.get("total_tokens", 0)

    # Build feature breakdown
    feature_breakdown: List[FeatureUsageStat] = []
    for item in feature_aggregations:
        f_key = item.get("_id", "unknown")
        f_tokens = item.get("total_tokens", 0)
        pct = round((f_tokens / total_tokens * 100.0), 1) if total_tokens > 0 else 0.0
        feature_breakdown.append(
            FeatureUsageStat(
                feature=f_key,
                display_name=FEATURE_NAMES.get(f_key, f_key.replace("-", " ").title()),
                request_count=item.get("request_count", 0),
                total_tokens=f_tokens,
                pct_of_total=pct,
            )
        )

    # Sort features by total tokens descending
    feature_breakdown.sort(key=lambda f: f.total_tokens, reverse=True)

    # 3. Calculate daily usage today
    daily_pipeline = [
        {
            "$match": {
                **match_filter,
                "created_at": {"$gte": start_of_day},
            }
        },
        {"$group": {"_id": None, "daily_tokens": {"$sum": "$total_tokens"}}},
    ]

    daily_cursor = db.ai_generations.aggregate(daily_pipeline)
    daily_res = await daily_cursor.to_list(length=1)
    daily_tokens_used = daily_res[0]["daily_tokens"] if daily_res else 0

    quota = settings.AI_DAILY_TOKEN_QUOTA
    quota_used_pct = min(100.0, round((daily_tokens_used / quota) * 100.0, 1))
    estimated_cost_usd = round((total_tokens / 1000.0) * COST_PER_1K_TOKENS, 4)

    return AIUsageSummaryResponse(
        total_requests=total_requests,
        total_prompt_tokens=total_prompt_tokens,
        total_completion_tokens=total_completion_tokens,
        total_tokens=total_tokens,
        estimated_cost_usd=estimated_cost_usd,
        daily_tokens_used=daily_tokens_used,
        daily_token_quota=quota,
        quota_used_pct=quota_used_pct,
        feature_breakdown=feature_breakdown,
        recent_logs=recent_logs,
    )
