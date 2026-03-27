# syntax=docker/dockerfile:1.7

FROM node:24-bookworm-slim AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY shared/package.json shared/tsconfig.json shared/
COPY apps/frontend/package.json apps/frontend/tsconfig.json apps/frontend/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
  pnpm config set store-dir /pnpm/store && \
  pnpm install --frozen-lockfile --filter @spacier/frontend...

FROM deps AS build
COPY shared ./shared
COPY apps/frontend ./apps/frontend

ARG VITE_API_URL=/rpc
ARG VITE_IBAN=BE29893944052464
ARG VITE_IBAN_NAME=KO-LAB

ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_IBAN=${VITE_IBAN}
ENV VITE_IBAN_NAME=${VITE_IBAN_NAME}

RUN pnpm --filter @spacier/frontend build

FROM nginx:1.27-alpine AS runtime
COPY infra/nginx.frontend.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/frontend/dist /usr/share/nginx/html

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
