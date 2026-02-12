# ============================================================
# SOA One — Multi-stage Docker build
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
RUN npm install

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
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/server/node_modules ./packages/server/node_modules
COPY --from=deps /app/packages/engine/node_modules ./packages/engine/node_modules
COPY --from=engine-build /app/packages/engine/dist ./packages/engine/dist
COPY --from=engine-build /app/packages/engine/package.json ./packages/engine/
COPY --from=server-build /app/packages/server/dist ./packages/server/dist
COPY --from=server-build /app/packages/server/node_modules/.prisma ./packages/server/node_modules/.prisma
COPY packages/server/prisma ./packages/server/prisma
COPY packages/server/package.json ./packages/server/
COPY package.json ./
EXPOSE 4000
CMD ["sh", "-c", "cd packages/server && npx prisma db push --skip-generate && node dist/index.js"]

# ============================================================
# Client build
# ============================================================
FROM deps AS client-build
COPY packages/client/ ./packages/client/
COPY tsconfig.json ./
RUN npm run build:client

FROM nginx:alpine AS client
COPY --from=client-build /app/packages/client/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
