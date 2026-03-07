FROM node:24-bookworm-slim

WORKDIR /app

RUN corepack enable

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY shared/package.json shared/tsconfig.json shared/
COPY apps/backend/package.json apps/backend/tsconfig.json apps/backend/

RUN pnpm install --frozen-lockfile

COPY shared shared
COPY apps/backend apps/backend

ENV PORT=4000
ENV DATA_DIR=/app/apps/backend/data

EXPOSE 4000

CMD ["pnpm", "--filter", "@spacier/backend", "start"]
