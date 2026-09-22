# ==============================================================================
# TaskPilot Backend - Production Multi-Stage Dockerfile
# Python 3.11-slim Base with Non-Root Security and Gunicorn/Uvicorn ASGI Setup
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build & Dependency Wheel Creation
# ------------------------------------------------------------------------------
FROM python:3.11-slim AS builder

# Prevent python from writing pyc files and buffering stdout
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /build

# Install system compilation dependencies required for C-extensions (e.g. bcrypt)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy only dependency definitions to leverage Docker layer caching
COPY requirements.txt .

# Build wheels into dedicated wheelhouse directory
RUN pip install --upgrade pip && \
    pip wheel --no-cache-dir --wheel-dir /build/wheels -r requirements.txt


# ------------------------------------------------------------------------------
# Stage 2: Minimal Production Runtime
# ------------------------------------------------------------------------------
FROM python:3.11-slim AS runner

# Security: Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000 \
    HOST=0.0.0.0 \
    ENVIRONMENT=production \
    PATH="/home/appuser/.local/bin:$PATH"

WORKDIR /app

# Install minimal runtime dependencies (curl for container health checks)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Security: Create unprivileged non-root user and group
RUN groupadd -g 10001 appgroup && \
    useradd -u 10001 -g appgroup -m -s /bin/bash appuser

# Copy wheels from builder stage and install into system python
COPY --from=builder /build/wheels /wheels
RUN pip install --no-cache-dir /wheels/* && \
    rm -rf /wheels

# Copy application source code and deployment scripts
COPY --chown=appuser:appgroup ./app /app/app
COPY --chown=appuser:appgroup ./scripts /app/scripts

# Switch to unprivileged non-root execution
USER appuser

# Expose standard ASGI container port
EXPOSE 8000

# Docker Healthcheck targeting FastAPI /api/health endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

# Launch using Gunicorn with Uvicorn worker class for production multiprocessing
CMD ["gunicorn", "app.main:app", \
     "--workers", "4", \
     "--worker-class", "uvicorn.workers.UvicornWorker", \
     "--bind", "0.0.0.0:8000", \
     "--timeout", "120", \
     "--keep-alive", "5", \
     "--access-logfile", "-", \
     "--error-logfile", "-"]
