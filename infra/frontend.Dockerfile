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
COPY .git ./.git

ARG VITE_API_URL=http://localhost:4000/rpc
ARG VITE_IBAN=BE29893944052464
ARG VITE_IBAN_NAME=KO-LAB
ARG VITE_APP_VERSION=dev

ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_IBAN=${VITE_IBAN}
ENV VITE_IBAN_NAME=${VITE_IBAN_NAME}
ENV VITE_APP_VERSION=${VITE_APP_VERSION}

RUN RESOLVED_APP_VERSION="$VITE_APP_VERSION" && \
  if [ -z "$RESOLVED_APP_VERSION" ] || [ "$RESOLVED_APP_VERSION" = "dev" ]; then \
    if [ -f .git/HEAD ]; then \
      GIT_HEAD="$(cat .git/HEAD)"; \
      if echo "$GIT_HEAD" | grep -q '^ref: '; then \
        GIT_REF_PATH="${GIT_HEAD#ref: }"; \
        if [ -f ".git/${GIT_REF_PATH}" ]; then \
          RESOLVED_APP_VERSION="$(cat ".git/${GIT_REF_PATH}")"; \
        elif [ -f .git/packed-refs ]; then \
          RESOLVED_APP_VERSION="$(grep " ${GIT_REF_PATH}$" .git/packed-refs | tail -n 1 | awk '{print $1}')"; \
        fi; \
      else \
        RESOLVED_APP_VERSION="$GIT_HEAD"; \
      fi; \
    fi; \
  fi && \
  if [ -z "$RESOLVED_APP_VERSION" ]; then RESOLVED_APP_VERSION="dev"; fi && \
  export VITE_APP_VERSION="$RESOLVED_APP_VERSION" && \
  pnpm --filter @spacier/frontend build && \
  printf '{"version":"%s"}\n' "$RESOLVED_APP_VERSION" > apps/frontend/dist/version.json

EXPOSE 4173

CMD ["pnpm", "--filter", "@spacier/frontend", "start", "--host", "0.0.0.0", "--port", "4173"]
