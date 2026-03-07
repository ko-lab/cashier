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

## Testing

```bash
pnpm test:all
```

Or run just one side:

```bash
pnpm test:fe
pnpm test:be
```
