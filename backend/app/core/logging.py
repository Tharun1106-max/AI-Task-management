"""Structured JSON Logging & Distributed Tracing for TaskPilot.

Provides:
- Contextual correlation/request ID propagation using contextvars
- JSON formatting for production log aggregation (CloudWatch, Datadog, Render, Grafana Loki)
- Human-friendly colored logging for local development
- ASGI Request Tracing Middleware with latency and status code capture
"""

from contextvars import ContextVar
from datetime import datetime, timezone
import json
import logging
import sys
import time
import traceback
from typing import Any, Callable, Dict, Optional
import uuid

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

# Context variable to hold request correlation ID across async coroutines
correlation_id_ctx: ContextVar[str] = ContextVar("correlation_id", default="-")


class JSONFormatter(logging.Formatter):
    """Formats Python logging records as single-line structured JSON objects."""

    def format(self, record: logging.LogRecord) -> str:
        log_payload: Dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "correlation_id": correlation_id_ctx.get(),
            "process_id": record.process,
            "thread_name": record.threadName,
        }

        # Include source location if debugging or warning/error
        if record.levelno >= logging.WARNING:
            log_payload["source"] = {
                "file": record.pathname,
                "line": record.lineno,
                "function": record.funcName,
            }

        # Include custom extra parameters passed to logger
        for key in ("path", "method", "status_code", "duration_ms", "client_ip", "user_id"):
            if hasattr(record, key):
                log_payload[key] = getattr(record, key)

        # Include exception traceback if present
        if record.exc_info:
            log_payload["exception"] = {
                "type": record.exc_info[0].__name__ if record.exc_info[0] else "Unknown",
                "message": str(record.exc_info[1]),
                "stacktrace": traceback.format_exception(*record.exc_info),
            }

        return json.dumps(log_payload, default=str)


class DevelopmentFormatter(logging.Formatter):
    """Clean readable log formatter for local development with correlation ID."""

    COLORS = {
        logging.DEBUG: "\033[36m",     # Cyan
        logging.INFO: "\033[32m",      # Green
        logging.WARNING: "\033[33m",   # Yellow
        logging.ERROR: "\033[31m",     # Red
        logging.CRITICAL: "\033[41m",  # Red Background
    }
    RESET = "\033[0m"

    def format(self, record: logging.LogRecord) -> str:
        color = self.COLORS.get(record.levelno, self.RESET)
        corr_id = correlation_id_ctx.get()
        corr_str = f" [{corr_id[:8]}]" if corr_id and corr_id != "-" else ""
        time_str = datetime.now(timezone.utc).strftime("%H:%M:%S.%f")[:-3]

        formatted = (
            f"{color}{time_str} [{record.levelname:<7}]{self.RESET} "
            f"\033[90m[{record.name}]{corr_str}:\033[0m {record.getMessage()}"
        )

        if record.exc_info:
            formatted += "\n" + "".join(traceback.format_exception(*record.exc_info))

        return formatted


def setup_logging(environment: str = "development", log_level: str = "INFO") -> None:
    """Configures global logging handlers based on application environment.

    Args:
        environment: 'development', 'staging', or 'production'
        log_level: Minimum logging level ('DEBUG', 'INFO', 'WARNING', 'ERROR')
    """
    level = getattr(logging, log_level.upper(), logging.INFO)

    root_logger = logging.getLogger()
    root_logger.setLevel(level)

    # Remove pre-existing handlers to avoid duplication
    for handler in list(root_logger.handlers):
        root_logger.removeHandler(handler)

    stream_handler = logging.StreamHandler(sys.stdout)
    stream_handler.setLevel(level)

    if environment.lower() in ("production", "staging"):
        stream_handler.setFormatter(JSONFormatter())
    else:
        stream_handler.setFormatter(DevelopmentFormatter())

    root_logger.addHandler(stream_handler)

    # Suppress verbose noisy third-party loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.error").setLevel(logging.INFO)
    logging.getLogger("motor").setLevel(logging.WARNING)
    logging.getLogger("pymongo").setLevel(logging.WARNING)


class RequestTracingMiddleware(BaseHTTPMiddleware):
    """ASGI Middleware to trace requests with correlation IDs and latency logs."""

    def __init__(self, app: Any):
        super().__init__(app)
        self.logger = logging.getLogger("taskpilot.http")

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Extract existing tracing headers or generate a clean UUIDv4
        correlation_id = (
            request.headers.get("X-Correlation-ID")
            or request.headers.get("X-Request-ID")
            or uuid.uuid4().hex
        )
        token = correlation_id_ctx.set(correlation_id)

        start_time = time.perf_counter()
        client_ip = request.client.host if request.client else "unknown"
        path = request.url.path
        method = request.method

        try:
            response = await call_next(request)
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)

            # Attach correlation ID to outgoing response headers
            response.headers["X-Correlation-ID"] = correlation_id

            # Avoid logging excessive noise for automated health check polling
            if path != "/api/health":
                extra_data = {
                    "path": path,
                    "method": method,
                    "status_code": response.status_code,
                    "duration_ms": duration_ms,
                    "client_ip": client_ip,
                }
                log_msg = f"{method} {path} -> {response.status_code} ({duration_ms}ms)"
                if response.status_code >= 500:
                    self.logger.error(log_msg, extra=extra_data)
                elif response.status_code >= 400:
                    self.logger.warning(log_msg, extra=extra_data)
                else:
                    self.logger.info(log_msg, extra=extra_data)

            return response
        except Exception as exc:
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
            self.logger.exception(
                f"Unhandled Exception in {method} {path} ({duration_ms}ms): {exc}",
                extra={
                    "path": path,
                    "method": method,
                    "status_code": 500,
                    "duration_ms": duration_ms,
                    "client_ip": client_ip,
                },
            )
            raise
        finally:
            correlation_id_ctx.reset(token)
