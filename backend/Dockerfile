# ============================================================
# Sapa-Tazkia Backend — Multi-Stage Dockerfile
# Stage 1: Install dependencies
# Stage 2: Run production-ready Node.js app (minimal image)
# ============================================================

# ------- Stage 1: Dependencies -------
FROM node:20-alpine AS deps
WORKDIR /app

# Copy package files first for layer caching
COPY package*.json ./
RUN npm ci --only=production

# ------- Stage 2: Production image -------
FROM node:20-alpine AS runner
WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodeuser

# Copy production dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY --chown=nodeuser:nodejs . .

# Generate Prisma client
RUN npx prisma generate

# Remove dev files
RUN rm -f .env.production .env.example

# Switch to non-root user
USER nodeuser

EXPOSE 5000

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:5000/health || exit 1

# Use dumb-init as PID 1 for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/app.js"]
