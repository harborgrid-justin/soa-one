# ============================================================
# SOA One — Multi-stage Docker build (Production-Hardened)
# ============================================================

# Base stage
FROM node:20-alpine AS base
WORKDIR /app
COPY package.json ./
COPY packages/engine/package.json ./packages/engine/
COPY packages/server/package.json ./packages/server/
COPY packages/client/package.json ./packages/client/

# Install dependencies
FROM base AS deps
RUN npm ci --ignore-scripts && npm cache clean --force

# Build engine
FROM deps AS engine-build
COPY packages/engine/ ./packages/engine/
COPY tsconfig.json ./
RUN npm run build:engine

# ============================================================
# Server build
# ============================================================
FROM engine-build AS server-build
COPY packages/server/ ./packages/server/
RUN cd packages/server && npx prisma generate && npx tsc

FROM node:20-alpine AS server

# Security: add non-root user
RUN addgroup -g 1001 -S soaone && \
    adduser -S soaone -u 1001 -G soaone

# Security: install dumb-init for proper signal handling in containers
RUN apk add --no-cache dumb-init

WORKDIR /app

COPY --from=deps --chown=soaone:soaone /app/node_modules ./node_modules
COPY --from=deps --chown=soaone:soaone /app/packages/server/node_modules ./packages/server/node_modules
COPY --from=deps --chown=soaone:soaone /app/packages/engine/node_modules ./packages/engine/node_modules
COPY --from=engine-build --chown=soaone:soaone /app/packages/engine/dist ./packages/engine/dist
COPY --from=engine-build --chown=soaone:soaone /app/packages/engine/package.json ./packages/engine/
COPY --from=server-build --chown=soaone:soaone /app/packages/server/dist ./packages/server/dist
COPY --from=server-build --chown=soaone:soaone /app/packages/server/node_modules/.prisma ./packages/server/node_modules/.prisma
COPY --chown=soaone:soaone packages/server/prisma ./packages/server/prisma
COPY --chown=soaone:soaone packages/server/package.json ./packages/server/
COPY --chown=soaone:soaone package.json ./

# Security: drop to non-root user
USER soaone

# Security: read-only filesystem hint — mount /tmp as writable if needed
ENV NODE_ENV=production

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/api/v1/health || exit 1

# Use dumb-init to properly forward signals for graceful shutdown
ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "-c", "cd packages/server && npx prisma db push --skip-generate && node dist/index.js"]

# ============================================================
# Client build
# ============================================================
FROM deps AS client-build
COPY packages/client/ ./packages/client/
COPY tsconfig.json ./
RUN npm run build:client

FROM nginx:alpine AS client

# Security: run nginx as non-root
RUN addgroup -g 1001 -S soaone && \
    adduser -S soaone -u 1001 -G soaone && \
    chown -R soaone:soaone /var/cache/nginx && \
    chown -R soaone:soaone /var/log/nginx && \
    chown -R soaone:soaone /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && \
    chown -R soaone:soaone /var/run/nginx.pid

COPY --from=client-build --chown=soaone:soaone /app/packages/client/dist /usr/share/nginx/html
COPY --chown=soaone:soaone nginx.conf /etc/nginx/conf.d/default.conf

USER soaone
EXPOSE 80
