"""Thread-safe in-memory sliding window rate limiter and Gemini 429 exponential backoff resilience."""

import asyncio
from collections import defaultdict, deque
import logging
import random
import time
from typing import Any, Callable, Coroutine, Dict, Optional, Tuple, TypeVar
from fastapi import HTTPException, Request, status

from app.config import get_settings

logger = logging.getLogger("taskpilot.rate_limit")
settings = get_settings()

T = TypeVar("T")


# ==============================================================================
# Sliding Window Token / Request Rate Limiter
# ==============================================================================

class SlidingWindowRateLimiter:
    """In-memory sliding window rate limiter tracking request timestamps per client/user."""

    def __init__(self) -> None:
        self._requests: Dict[str, deque] = defaultdict(deque)
        self._lock = asyncio.Lock()

    async def check_rate_limit(
        self,
        key: str,
        limit: int = 30,
        window_seconds: int = 60,
    ) -> Tuple[bool, int, int]:
        """Checks whether the given key has exceeded the rate limit.

        Returns:
            Tuple[is_allowed: bool, remaining_requests: int, retry_after_seconds: int]
        """
        async with self._lock:
            now = time.time()
            cutoff = now - window_seconds
            queue = self._requests[key]

            # Purge expired timestamps outside the sliding window
            while queue and queue[0] < cutoff:
                queue.popleft()

            current_count = len(queue)
            if current_count >= limit:
                oldest_timestamp = queue[0]
                retry_after = max(1, int(window_seconds - (now - oldest_timestamp)))
                return False, 0, retry_after

            queue.append(now)
            remaining = limit - (current_count + 1)
            return True, remaining, 0

    async def cleanup_idle_keys(self, max_idle_seconds: int = 300) -> None:
        """Periodically cleans up keys with no active timestamps."""
        async with self._lock:
            now = time.time()
            idle_keys = [
                k
                for k, q in self._requests.items()
                if not q or (now - q[-1] > max_idle_seconds)
            ]
            for k in idle_keys:
                del self._requests[k]


ai_rate_limiter = SlidingWindowRateLimiter()


# ==============================================================================
# FastAPI Dependency for AI Endpoints
# ==============================================================================

async def rate_limit_ai_requests(request: Request) -> None:
    """Dependency enforcing rate limits on AI operations by user ID or client IP."""
    client_ip = request.client.host if request.client else "unknown"

    # Inspect authorization header for user identification if available
    auth_header = request.headers.get("authorization", "")
    rate_limit_key = f"ip:{client_ip}"
    if auth_header.startswith("Bearer "):
        token_snippet = auth_header[-16:]
        rate_limit_key = f"auth:{token_snippet}"

    limit = settings.AI_RATE_LIMIT_PER_MINUTE
    is_allowed, remaining, retry_after = await ai_rate_limiter.check_rate_limit(
        key=rate_limit_key,
        limit=limit,
        window_seconds=60,
    )

    if not is_allowed:
        logger.warning(
            "Rate limit exceeded for key [%s]. Retry after %ds.",
            rate_limit_key,
            retry_after,
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded: Maximum {limit} AI requests per minute. Please wait {retry_after} seconds.",
            headers={"Retry-After": str(retry_after)},
        )


# ==============================================================================
# Gemini 429 & Quota Exponential Backoff Helper
# ==============================================================================

async def with_gemini_backoff(
    func: Callable[[], Coroutine[Any, Any, T]],
    max_retries: int = 3,
    initial_delay: float = 1.0,
    backoff_factor: float = 2.0,
) -> T:
    """Executes a Gemini API coroutine with exponential backoff on 429 Rate Limit and ResourceExhausted errors."""
    delay = initial_delay

    for attempt in range(1, max_retries + 1):
        try:
            return await func()
        except Exception as exc:
            exc_str = str(exc).lower()
            is_rate_limit = (
                "429" in exc_str
                or "too many requests" in exc_str
                or "rate_limit_exceeded" in exc_str
                or "resource_exhausted" in exc_str
                or "quota" in exc_str
                or getattr(exc, "status_code", None) == 429
            )

            if is_rate_limit and attempt < max_retries:
                jitter = random.uniform(0.1, 0.4)
                sleep_time = delay + jitter
                logger.warning(
                    "Gemini API 429 / Quota Limit triggered on attempt %d/%d. Backing off for %.2fs...",
                    attempt,
                    max_retries,
                    sleep_time,
                )
                await asyncio.sleep(sleep_time)
                delay *= backoff_factor
            else:
                if is_rate_limit:
                    logger.error("Gemini API rate/quota limit persisted after %d retries.", max_retries)
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail="The upstream Gemini AI inference service is temporarily busy. Please wait a few seconds before trying again.",
                    ) from exc
                raise exc

# Backward compatibility alias
with_groq_backoff = with_gemini_backoff

    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Unexpected inference error during AI execution.",
    )
