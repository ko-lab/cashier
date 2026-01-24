FROM node:24-alpine

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/frontend/package.json apps/frontend/package.json
COPY shared/package.json shared/package.json

RUN pnpm install --frozen-lockfile --filter @spacier/frontend...

EXPOSE 5173

CMD ["pnpm", "--filter", "@spacier/frontend", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
