"""TaskPilot Backend Application Entrypoint.

Configures FastAPI with:
- Lifespan events for MongoDB async lifecycle management
- CORS middleware with configured origin filtering
- Centralized exception handlers (400, 401, 403, 404, 422, 500)
- GET /api/health endpoint with deep MongoDB connectivity check
"""

from contextlib import asynccontextmanager
from datetime import datetime, timezone
import logging
from typing import Any, AsyncGenerator, Dict, Optional

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import get_settings
from app.database.mongodb import db_manager
from app.routes.auth import router as auth_router
from app.routes.users import router as users_router
from app.routes.projects import router as projects_router
from app.routes.tasks import router as tasks_router
from app.routes.analytics import router as analytics_router
from app.routes.team import router as team_router
from app.routes.calendar import router as calendar_router
from app.routes.notifications import router as notifications_router
from app.routes.ai import router as ai_router
from app.routes.documents import router as documents_router
from app.routes.dependencies import router as dependencies_router
from app.routes.ai_usage import router as ai_usage_router

from app.core.logging import RequestTracingMiddleware, setup_logging

settings = get_settings()

# Configure structured logging (JSON in production, human-readable in development)
setup_logging(environment=settings.ENVIRONMENT)
logger = logging.getLogger("taskpilot.api")


# ==============================================================================
# Application Lifespan Context Manager
# ==============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Manages application startup and shutdown lifecycle hooks."""
    settings = get_settings()
    logger.info("Starting up %s (v%s) in [%s] mode...", settings.APP_NAME, settings.APP_VERSION, settings.ENVIRONMENT)

    # 1. Establish MongoDB connection pool
    try:
        await db_manager.connect()
        # Verify connectivity
        ping_res = await db_manager.ping()
        logger.info("MongoDB connection verified: %s", ping_res)

        # Ensure declarative indexes
        await db_manager.init_indexes()
    except Exception as exc:
        logger.warning(
            "MongoDB startup connection warning: %s. Application will start in degraded state until MongoDB is available.",
            exc,
        )

    yield

    # 2. Shutdown: Gracefully close active database pools
    logger.info("Shutting down %s...", settings.APP_NAME)
    await db_manager.disconnect()
    logger.info("Application shutdown complete.")


# ==============================================================================
# FastAPI Application Factory
# ==============================================================================

settings = get_settings()

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="AI-powered project and task management platform backend API.",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)


# ==============================================================================
# Middleware Configuration
# ==============================================================================

# Request tracing and correlation ID propagation (outermost)
app.add_middleware(RequestTracingMiddleware)

# Cross-Origin Resource Sharing
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



# ==============================================================================
# Router Registrations
# ==============================================================================

app.include_router(auth_router, prefix="/api/auth")
app.include_router(users_router, prefix="/api/users")
app.include_router(projects_router, prefix="/api/projects")
app.include_router(tasks_router, prefix="/api/tasks")
app.include_router(analytics_router, prefix="/api/analytics")
app.include_router(team_router, prefix="/api")
app.include_router(calendar_router, prefix="/api/calendar")
app.include_router(notifications_router, prefix="/api/notifications")
app.include_router(ai_router, prefix="/api/ai")
app.include_router(documents_router, prefix="/api")
app.include_router(dependencies_router, prefix="/api")
app.include_router(ai_usage_router, prefix="/api/ai")


# ==============================================================================
# Helper for Structured Error Payloads
# ==============================================================================

def create_error_response(
    status_code: int,
    code: str,
    message: str,
    details: Optional[Any] = None,
) -> JSONResponse:
    """Builds a standardized error JSON response across all exception types."""
    payload: Dict[str, Any] = {
        "success": False,
        "error": {
            "code": code,
            "message": message,
            "details": details,
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    return JSONResponse(status_code=status_code, content=payload)


# Mapping of standard HTTP status codes to machine-readable string codes
STATUS_CODE_NAME_MAP = {
    status.HTTP_400_BAD_REQUEST: "BAD_REQUEST",
    status.HTTP_401_UNAUTHORIZED: "UNAUTHORIZED",
    status.HTTP_403_FORBIDDEN: "FORBIDDEN",
    status.HTTP_404_NOT_FOUND: "NOT_FOUND",
    status.HTTP_405_METHOD_NOT_ALLOWED: "METHOD_NOT_ALLOWED",
    status.HTTP_409_CONFLICT: "CONFLICT",
    status.HTTP_422_UNPROCESSABLE_ENTITY: "UNPROCESSABLE_ENTITY",
    status.HTTP_500_INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
    status.HTTP_502_BAD_GATEWAY: "BAD_GATEWAY",
    status.HTTP_503_SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
}


# ==============================================================================
# Centralized Exception Handlers (400, 401, 403, 404, 422, 500)
# ==============================================================================

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    """Handles HTTPExceptions (e.g. 400, 401, 403, 404, etc.)."""
    error_code = STATUS_CODE_NAME_MAP.get(exc.status_code, f"HTTP_{exc.status_code}")
    message = str(exc.detail) if exc.detail else "An HTTP error occurred."

    return create_error_response(
        status_code=exc.status_code,
        code=error_code,
        message=message,
        details=getattr(exc, "headers", None),
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Handles Pydantic request schema validation errors (422 Unprocessable Entity)."""
    # Normalize Pydantic validation errors into clean field-level error descriptions
    formatted_errors = []
    for error in exc.errors():
        location = " -> ".join([str(loc) for loc in error.get("loc", [])])
        formatted_errors.append(
            {
                "field": location,
                "type": error.get("type", "value_error"),
                "message": error.get("msg", "Invalid value"),
            }
        )

    return create_error_response(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        code="VALIDATION_ERROR",
        message="The request payload failed data validation.",
        details=formatted_errors,
    )


@app.exception_handler(Exception)
async def global_unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch-all exception handler for unhandled errors (500 Internal Server Error)."""
    logger.exception("Unhandled application exception at [%s %s]: %s", request.method, request.url.path, exc)

    message = "An unexpected internal server error occurred."
    details = str(exc) if settings.DEBUG else None

    return create_error_response(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        code="INTERNAL_SERVER_ERROR",
        message=message,
        details=details,
    )


# ==============================================================================
# Base Endpoints
# ==============================================================================

@app.get(
    "/",
    tags=["Root"],
    summary="Root Service Info",
    response_description="Basic application metadata and API links",
)
async def root() -> Dict[str, Any]:
    """Root endpoint welcoming clients and directing them to interactive documentation."""
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
        "docs_url": "/docs",
        "health_url": "/api/health",
    }


@app.get(
    "/api/health",
    tags=["Monitoring"],
    summary="System Health Check",
    response_description="Live status of the API and backing infrastructure services",
)
async def health_check() -> JSONResponse:
    """Health check verifying API responsiveness and live MongoDB connection latency."""
    db_health: Dict[str, Any]
    db_operational: bool

    try:
        ping_result = await db_manager.ping()
        db_health = {
            "status": "connected",
            "database": ping_result.get("database"),
            "latency_ms": ping_result.get("latency_ms"),
        }
        db_operational = True
    except Exception as exc:
        db_health = {
            "status": "disconnected",
            "error": str(exc),
        }
        db_operational = False

    overall_status = "healthy" if db_operational else "degraded"
    response_status = status.HTTP_200_OK if db_operational else status.HTTP_503_SERVICE_UNAVAILABLE

    payload = {
        "status": overall_status,
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "services": {
            "mongodb": db_health,
        },
    }

    return JSONResponse(status_code=response_status, content=payload)
