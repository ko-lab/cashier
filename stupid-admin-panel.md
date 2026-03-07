# Stupid Admin Panel (Milestone 1 Addendum)

This is a deliberately simple admin addendum for milestone 1. It is not milestone 2.

## Goal

Allow admins to inspect transaction history and simple totals without adding full auth/session infrastructure or mutation workflows.

## Scope

In scope:
- Password-gated access to transaction export.
- Backend returns the full transaction dataset as JSON payload (`transactions.json`-equivalent structure).
- Frontend keeps exported transactions in memory only for the current runtime.
- Read-only dashboard with basic filters and aggregate totals.

Out of scope:
- Product/inventory edits.
- Role-based accounts, sessions, or token management.
- Persistent admin login state.
- Verification/accounting workflows from post-MVP.

## Security Model (Simple By Design)

- Admin submits a password via a form.
- Backend validates password against server env var `ADMIN_PANEL_PASSWORD`.
- If valid, backend responds with all transactions in one payload.
- If invalid, backend returns unauthorized.
- Frontend clears password state after submit and does not persist it to local storage/session storage/cookies.
- Transactions are held in frontend memory only; refresh/tab close resets access.

## API Shape

`admin.exportTransactions`

Input:
```json
{
  "password": "string"
}
```

Output:
```json
{
  "transactions": [
    {
      "id": "string",
      "createdAt": "string",
      "status": "pending|completed|canceled",
      "total": 0,
      "items": []
    }
  ]
}
```

## UX Expectations

Locked state:
- Show password form.
- On submit, call `admin.exportTransactions`.
- Show auth/config error when rejected.

Unlocked state:
- Show transaction totals/cards.
- Show filters (status + date range).
- Show transaction table (id, date, status, total, item count).
- Include explicit "lock" action that clears in-memory dataset.

## Storage Notes

Current source of truth remains SQLite (`transactions.sqlite`).
This addendum does not require physically writing a `transactions.json` file on disk.
