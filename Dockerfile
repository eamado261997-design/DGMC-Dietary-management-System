# ==============================================================================
# Multi-Stage Production Dockerfile for DGMC Dietary Management System
# Optimized for reproducible builds, Docker layer caching & minimal Alpine runtime
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build & Compilation (Alpine Builder)
# ------------------------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# Install native build toolchain required for compiling C/C++ native addons (e.g., better-sqlite3)
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    gcc \
    libc-dev

# Build environment configuration
ENV PUPPETEER_SKIP_DOWNLOAD=true \
    npm_config_legacy_peer_deps=true \
    NODE_ENV=development

# ------------------------------------------------------------------------------
# Layer Caching Optimization:
# Copy manifest and lock files first so this layer is cached unless dependencies change
# ------------------------------------------------------------------------------
COPY package.json package-lock.json* npm-shrinkwrap.json* ./

# Use 'npm ci' when package-lock.json is present for strict, reproducible, clean dependency installations
# Fallback to 'npm install --legacy-peer-deps' if no lockfile is mounted
RUN if [ -f package-lock.json ] || [ -f npm-shrinkwrap.json ]; then \
      npm ci --legacy-peer-deps --no-audit; \
    else \
      npm install --legacy-peer-deps --no-audit; \
    fi

# Copy full application source code after dependency installation to maximize layer caching
COPY . .

# Compile frontend static bundle and bundle backend server into dist/server.cjs
RUN npm run build

# Prune development dependencies to keep the node_modules bundle minimal
RUN npm prune --omit=dev --legacy-peer-deps --no-audit && \
    npm cache clean --force

# ------------------------------------------------------------------------------
# Stage 2: Ultra-Compact Minimal Production Runtime (Alpine Linux)
# ------------------------------------------------------------------------------
FROM node:22-alpine AS runner

# Install dumb-init for PID 1 signal handling (SIGTERM / SIGINT) and curl for container health checks
RUN apk add --no-cache \
    dumb-init \
    curl

WORKDIR /app

# Ensure application, log, and persistent data directories exist with proper non-root permissions
RUN mkdir -p /app/logs /app/data && \
    chown -R node:node /app

# Copy production artifacts from the builder stage with non-root ownership
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/db.json* ./

# Production environment variables
ENV NODE_ENV=production \
    PORT=3000

# Execute container as unprivileged non-root user (node uid/gid 1000)
USER node

# Expose application port
EXPOSE 3000

# Health check probe against API health endpoint
HEALTHCHECK --interval=20s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -fsS http://localhost:3000/api/health || exit 1

# Forward process signals cleanly via dumb-init
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Start production server
CMD ["node", "dist/server.cjs"]
