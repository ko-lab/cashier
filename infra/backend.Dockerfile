# syntax=docker/dockerfile:1.7

FROM node:24-bookworm-slim AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY shared/package.json shared/tsconfig.json shared/
COPY apps/backend/package.json apps/backend/tsconfig.json apps/backend/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
  pnpm config set store-dir /pnpm/store && \
  pnpm install --frozen-lockfile --prod --filter @spacier/backend...

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=deps /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/apps/backend/package.json ./apps/backend/package.json
COPY --from=deps /app/shared/package.json ./shared/package.json

COPY shared ./shared
COPY apps/backend ./apps/backend

ENV PORT=4000
ENV DATA_DIR=/app/apps/backend/data

EXPOSE 4000

CMD ["pnpm", "--filter", "@spacier/backend", "start"]
