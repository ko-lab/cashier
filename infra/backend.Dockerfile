# syntax=docker/dockerfile:1.7

FROM node:24-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production

# Build tools are required if better-sqlite3 needs to compile from source.
RUN apt-get update && apt-get install -y --no-install-recommends \
  python3 \
  make \
  g++ \
  && rm -rf /var/lib/apt/lists/*

# Install backend deps directly in backend package context (avoids workspace package-manager lockstep issues).
COPY apps/backend/package.json ./apps/backend/package.json
RUN cd apps/backend && npm install --omit=dev

COPY shared ./shared
COPY apps/backend ./apps/backend

ENV PORT=4000
ENV DATA_DIR=/app/apps/backend/data
ENV CATALOG_DIR=/app/apps/backend/catalog

EXPOSE 4000

CMD ["node", "apps/backend/src/server.ts"]
