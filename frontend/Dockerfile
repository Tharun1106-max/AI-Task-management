# ==============================================================================
# TaskPilot Frontend - Production Multi-Stage Dockerfile
# Node.js 20 Alpine Builder -> Nginx 1.25 Alpine Runner
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build & Bundle Compilation
# ------------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies strictly matching package-lock.json for reproducible builds
COPY package.json package-lock.json ./
RUN npm ci

# Build-time environment variable injection
ARG VITE_API_BASE_URL=/api
ARG VITE_APP_NAME="TaskPilot"
ARG VITE_ENABLE_AI_FEATURES=true

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_APP_NAME=$VITE_APP_NAME \
    VITE_ENABLE_AI_FEATURES=$VITE_ENABLE_AI_FEATURES \
    NODE_ENV=production

# Copy application source code
COPY . .

# Compile TypeScript and bundle with Vite
RUN npm run build


# ------------------------------------------------------------------------------
# Stage 2: Production Web Server (Nginx Alpine)
# ------------------------------------------------------------------------------
FROM nginx:1.25-alpine AS runner

# Remove default boilerplate configuration
RUN rm -rf /etc/nginx/conf.d/default.conf /usr/share/nginx/html/*

# Copy custom high-performance Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled static assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose standard HTTP web port
EXPOSE 80

# Health check to ensure Nginx server is actively responding
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost/healthz || exit 1

# Run Nginx in the foreground
CMD ["nginx", "-g", "daemon off;"]
