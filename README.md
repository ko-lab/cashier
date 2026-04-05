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

Frontend runs on Vite, backend runs on oRPC. Runtime data is stored under `apps/backend/data/` (including `transactions.sqlite`). Product catalog lives in `apps/backend/catalog/products.json` (kept in git, not in the mounted runtime data dir).

## Docker / Dokploy (optimized)

This repo includes production-oriented Dockerfiles with faster rebuild characteristics:

- `infra/frontend.Dockerfile`
  - single container serving built frontend via `vite preview`
  - minimal moving parts (no extra web server in the container)
- `infra/backend.Dockerfile`
  - single-stage runtime build (keeps pnpm workspace resolution simple)
  - cached dependency install
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
- optional env vars:
  - `VITE_API_URL` (defaults to `/rpc` for same-domain routing)
  - `VITE_APP_VERSION` (defaults to `dev`; set to commit SHA or build timestamp)

For GitHub Actions deploy verification, also configure:

- repository variable:
  - `DEPLOY_CHECK_URL` (public URL to the live frontend, e.g. `https://cashier.ko-lab.space`)
- repository secret:
  - `DOKPLOY_WEBHOOK_URL`

The Dokploy compose is intentionally minimal for Dokploy: no Traefik labels, no host port bindings, and uses external `dokploy-network` + a named volume (`backend-data`) for SQLite persistence.

### Client auto-refresh on new deploy

The frontend checks `/version.json` every 60 seconds.

- It compares the server version against `VITE_APP_VERSION` baked into the running app.
- If versions differ, it reloads automatically **only when safe**:
  - POS mode
  - cart view
  - no selected items
  - no active transaction/loading
- If not safe yet, it shows a small notice and refreshes once the page becomes idle.

In Docker builds, `infra/frontend.Dockerfile` writes `dist/version.json` from `VITE_APP_VERSION`.
Set `VITE_APP_VERSION` in Dokploy/CI to a unique value per deploy (e.g. git SHA).

The frontend version is also exposed in two places for quick verification:

- Footer text in the app: `Frontend commit: <version>`
- HTML meta tag on `/`: `<meta name="app-commit" content="<version>">`

### Dokploy import guide

You can deploy this stack either from the Dokploy UI or via Dokploy CLI.

#### Option A — Dokploy UI (recommended)

1. Push this repository branch to GitHub/Git provider.
2. In Dokploy, create a new **Compose** application.
3. Select this repository and branch.
4. Set compose file path to:

   ```
   infra/docker-compose.dokploy.yml
   ```

5. Add environment variables (from `infra/.env.example`):
   - `ADMIN_PANEL_PASSWORD`
   - `VITE_IBAN`
   - `VITE_IBAN_NAME`
   - optional: `VITE_API_URL` (default is `/rpc` for same-domain routing)
6. Expose routes on the same domain (`cashier.ko-lab.be`) with path-based routing:
   - Frontend service: host `cashier.ko-lab.be`, path `/`, port `4173`
   - Backend RPC: host `cashier.ko-lab.be`, path `/rpc`, port `4000`
   - Optional backend health: host `cashier.ko-lab.be`, path `/healthz`, port `4000`
7. Deploy.

After deploy, verify:
- Frontend loads at `https://cashier.ko-lab.be`
- RPC works at `https://cashier.ko-lab.be/rpc`
- Health endpoint works at `https://cashier.ko-lab.be/healthz` (if routed)

#### Option B — Dokploy CLI

If you manage Dokploy through its CLI, use the same compose file and env values:

```bash
# From repo root
cp infra/.env.example infra/.env
# edit infra/.env with real values

# Then deploy using your Dokploy CLI workflow,
# referencing infra/docker-compose.dokploy.yml
```

Notes for CLI usage:
- Keep `infra/.env` out of git (contains secrets).
- Re-deploy on each new commit/branch update.
- If you split frontend/backend into separate Dokploy apps later, set `VITE_API_URL` to the backend public `/rpc` URL.

### GitHub Actions deploy webhook + live commit verification

Workflow: `.github/workflows/dokploy-webhook.yml`

- Triggers on push to `master`
- Calls Dokploy via `DOKPLOY_WEBHOOK_URL`
- Sends both branch ref and pushed SHA in the webhook payload
- Waits until the live page at `DEPLOY_CHECK_URL` contains the pushed commit in:
  - `<meta name="app-commit" content="${GITHUB_SHA}">`

The job retries with polling and fails on timeout, so a green workflow means the live page has updated to the expected frontend commit.

## Testing

```bash
pnpm test:all
```

Or run just one side:

```bash
pnpm test:fe
pnpm test:be
```
