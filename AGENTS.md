# AGENTS.md

Guidelines for AI/code agents working in this repository.

## Scope
- Applies to the whole `cashier` repo.
- Prefer small, reviewable commits.

## Workflow
1. Read relevant code before editing.
2. Keep behavior unchanged unless explicitly requested.
3. Run checks before pushing:
   - `pnpm -r test`
   - `pnpm -r build`
4. Push only after checks pass.

## Code style
- Use existing TypeScript conventions.
- Avoid `any` when shared model types exist.
- Keep UI text consistent (`Customer` in UI, internal aliases can remain for backward compatibility).

## Frontend structure
- Keep page-level UI in `apps/frontend/src/pages/*`.
- Avoid growing `App.tsx`; extract cohesive sections into page/components.

## Backend/API
- Reuse schemas from `shared/models.ts` and contracts from `shared/contract.ts`.
- Preserve backward-compatible aliases unless migration is explicitly requested.
- Product visibility (`active`) is managed through stock state/events (not static catalog product fields).

## Customer credit feature
- Source of truth for credit mutations is the ledger.
- Never allow checkout debit to create negative balances.
- Keep top-up/debit flows auditable.

## Safety
- Do not commit secrets.
- Do not run destructive commands unless explicitly requested.
