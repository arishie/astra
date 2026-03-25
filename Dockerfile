# Astra AI Agent Framework
# Multi-stage build for production

# ============================================
# Build Stage
# ============================================
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies (including X11 for robotjs)
RUN apk add --no-cache python3 make g++ git \
    libx11-dev libxtst-dev libpng-dev

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --legacy-peer-deps

# Copy source code
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN npm run build 2>/dev/null || npx tsc

# ============================================
# Production Stage
# ============================================
FROM node:22-alpine AS production

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache \
    python3 \
    py3-pip \
    docker-cli \
    curl \
    && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S astra && \
    adduser -S astra -u 1001 -G astra

# Copy built application
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# Create necessary directories
RUN mkdir -p workspaces astra_memory knowledge_base screenshots && \
    chown -R astra:astra /app

# Switch to non-root user
USER astra

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Start application
CMD ["node", "dist/index.js"]
