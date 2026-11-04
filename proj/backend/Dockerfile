# VehicleFlow backend (Node.js + Express + SQLite via better-sqlite3).
# Build context = repository root (the backend needs database/schema.sql for migrations).

# ---- Stage 1: install production dependencies. Build tools are here only in case better-sqlite3 has to compile. ----
FROM node:20-alpine AS deps
RUN apk add --no-cache python3 make g++
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# ---- Stage 2: small runtime image (no compilers) ----
FROM node:20-alpine
ENV NODE_ENV=production \
    DB_PATH=/app/data/vehicleflow.db
WORKDIR /app/backend

COPY --from=deps /app/backend/node_modules ./node_modules
COPY backend/package*.json ./
COPY backend/src ./src
COPY backend/scripts ./scripts
COPY database /app/database

# /app/data holds vehicleflow.db. It is mounted as a named volume by docker-compose.yml;
# creating it here (owned by the non-root "node" user) makes the empty volume writable on first start.
RUN mkdir -p /app/data && chown -R node:node /app/data
VOLUME /app/data

USER node
EXPOSE 5000
CMD ["node", "src/server.js"]
