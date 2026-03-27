# syntax=docker/dockerfile:1.7

FROM node:24-bookworm-slim
WORKDIR /app
RUN corepack enable

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY shared/package.json shared/tsconfig.json shared/
COPY apps/frontend/package.json apps/frontend/tsconfig.json apps/frontend/

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
  pnpm config set store-dir /pnpm/store && \
  pnpm install --frozen-lockfile --filter @spacier/frontend...

COPY shared ./shared
COPY apps/frontend ./apps/frontend

ARG VITE_API_URL=http://localhost:4000/rpc
ARG VITE_IBAN=BE29893944052464
ARG VITE_IBAN_NAME=KO-LAB

ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_IBAN=${VITE_IBAN}
ENV VITE_IBAN_NAME=${VITE_IBAN_NAME}

RUN pnpm --filter @spacier/frontend build

EXPOSE 4173

CMD ["pnpm", "--filter", "@spacier/frontend", "start", "--host", "0.0.0.0", "--port", "4173"]
