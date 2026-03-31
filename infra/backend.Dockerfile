# syntax=docker/dockerfile:1.7

FROM oven/bun:1.2

WORKDIR /app
ENV NODE_ENV=production

COPY package.json ./
COPY shared/package.json shared/tsconfig.json shared/
COPY apps/backend/package.json apps/backend/tsconfig.json apps/backend/

RUN bun install --production

COPY shared ./shared
COPY apps/backend ./apps/backend

ENV PORT=4000
ENV DATA_DIR=/app/apps/backend/data
ENV CATALOG_DIR=/app/apps/backend/catalog

EXPOSE 4000

CMD ["bun", "run", "--cwd", "apps/backend", "start"]
