# Spacier POS

Minimal fridge POS with a React + Vite frontend and a Node 24 + oRPC backend. Transactions are stored in a local SQLite file (no external database required).

## Local development

1. Install dependencies

```bash
pnpm install
```

2. Configure frontend environment

```bash
cp apps/frontend/.env.example apps/frontend/.env.local
```

Update the values in `apps/frontend/.env.local` if needed.

3. Start frontend + backend

```bash
pnpm dev:all
```

To enable the simple admin panel export endpoint, set a backend password first:

```bash
export ADMIN_PANEL_PASSWORD="change-me"
```

Frontend runs on Vite, backend runs on oRPC. Data is stored under `apps/backend/data/` (including `transactions.sqlite`).

## Docker / Dokploy (optimized)

This repo includes production-oriented Dockerfiles with faster rebuild characteristics:

- `infra/frontend.Dockerfile`
  - multi-stage build
  - static frontend served by nginx (small runtime image)
  - immutable cache headers for `/assets/*`
  - `/rpc` and `/client-log` proxied to backend
- `infra/backend.Dockerfile`
  - multi-stage build
  - production-only dependency install
  - `/healthz` endpoint for container health checks

For local compose:

```bash
pnpm docker:up
```

For Dokploy, use:

- compose file: `infra/docker-compose.dokploy.yml`
- required env vars:
  - `ADMIN_PANEL_PASSWORD`
  - `VITE_IBAN`
  - `VITE_IBAN_NAME`
  - optional: `VITE_API_URL` (defaults to `/rpc`)

The Dokploy compose uses health checks and a named volume (`backend-data`) for SQLite persistence.

## Testing

```bash
pnpm test:all
```

Or run just one side:

```bash
pnpm test:fe
pnpm test:be
```
