# syntax=docker/dockerfile:1.7

FROM node:24-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY shared/package.json shared/tsconfig.json shared/
COPY apps/backend/package.json apps/backend/tsconfig.json apps/backend/

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
  pnpm config set store-dir /pnpm/store && \
  pnpm install --frozen-lockfile --filter @spacier/backend...

COPY shared ./shared
COPY apps/backend ./apps/backend

ENV PORT=4000
ENV DATA_DIR=/app/apps/backend/data

EXPOSE 4000

CMD ["pnpm", "--filter", "@spacier/backend", "start"]
