FROM node:24-alpine

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json apps/backend/package.json
COPY shared/package.json shared/package.json

RUN pnpm install --frozen-lockfile --filter @spacier/backend...

COPY shared shared
COPY apps/backend apps/backend

ENV PORT=4000
EXPOSE 4000

CMD ["pnpm", "--filter", "@spacier/backend", "start"]
