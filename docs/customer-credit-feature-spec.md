# Customer Credit Feature — Product & Behavior Spec

## Goal
Enable fast, safe checkout using preloaded customer credit, while keeping full traceability for money and stock movements.

## Non-goals
- No online payment gateway integration (external payment remains manual transfer/QR).
- No public self-service account creation.
- No anonymous credit payments.

## Terminology
- **Customer**: person record with PIN, balance, active flag, and type (`member` / `non_member`).
- **Credit**: prepaid balance in EUR.
- **Top-up**: credit increase.
- **Checkout debit**: credit decrease due to sale payment.
- **Ledger event**: immutable accounting record for each balance change.

---

## Feature Scope

### 1) Customer management (Admin)
Admin can:
- Create customer with display name + PIN + customer type.
- Enable/disable customer.
- Change PIN.
- View customer balance.
- Top up balance manually with optional note.
- View per-customer and global credit ledger.

### 2) Customer auth (POS)
- Customer is identified by username selection and/or PIN (depending on flow).
- PIN auth returns active customer only.
- PIN must be numeric and length constrained by schema.

### 3) Checkout with credit (POS)
- Cashier creates transaction from cart.
- Option to pay with customer credit.
- Payment succeeds only if:
  - selected customer is authenticated,
  - customer has enough balance for requested credit usage,
  - transaction is still pending.
- On success:
  - transaction finalizes as completed,
  - credit ledger writes `checkout_debit`,
  - stock deltas are recorded,
  - UI returns to cart state.

### 4) Mixed payment model
- `total = creditUsed + externalAmount`
- `creditUsed` cannot exceed:
  - transaction total,
  - authenticated customer balance,
  - requested credit input.
- External amount is settled via existing QR transfer flow.

### 5) Top-up transaction flow
- Cashier starts a top-up transaction for selected customer and amount.
- After manual payment confirmation (`I paid`), transaction completes and writes ledger `topup` event.

---

## Data/Accounting Rules

1. **Ledger is source of truth for credit changes**.
2. Every balance update must create exactly one ledger event.
3. `preventNegative=true` for checkout debit.
4. Balance precision: 2 decimals (EUR cent precision).
5. Ledger entries are append-only (no mutation/deletion in normal flow).
6. If transaction finalization fails, no partial balance mutation should remain.

---

## UX Rules

1. Feature can be toggled on/off via `featureMemberCredit` flag.
2. If feature is disabled:
   - customer/top-up screens are hidden,
   - member-credit payment modal is unavailable,
   - customer-related transient state is cleared.
3. Member-priced items in checkout require explicit customer verification flow before payment unlock.
4. Errors must be operator-friendly:
   - invalid PIN,
   - customer mismatch,
   - insufficient balance,
   - expired admin session.

---

## API Surface (current expected)

- Public:
  - `member.list`
  - `member.authPin`
- Admin:
  - `admin.listMembers` / `admin.listCustomers` (alias)
  - `admin.createMember` / `admin.createCustomer` (alias)
  - `admin.setMemberPin` / `admin.setCustomerPin` (alias)
  - `admin.setMemberActive` / `admin.setCustomerActive` (alias)
  - `admin.topupCredit`
  - `admin.creditLedger`

> Note: aliases should remain backward-compatible until frontend and integrators are fully migrated to one canonical naming scheme.

---

## Cleanup Plan (implementation guidance)

1. **Naming consistency**
   - Prefer “Customer” in UI text.
   - Keep `member` naming in internal schema/API for compatibility, but avoid mixing terms in the same UI section.

2. **Component boundaries**
   - Keep customer credit UI isolated in dedicated page/components (modals, member section, admin customer tools).
   - Keep transaction creation/finalization orchestration in one container (`App`) until a dedicated state controller is introduced.

3. **Validation centralization**
   - Reuse shared schema constraints for PIN, top-up amount, and credit usage checks.
   - Avoid duplicated regex/number checks where possible.

4. **Testing priorities**
   - Add/extend backend tests for:
     - successful top-up ledger event,
     - checkout debit with `preventNegative`,
     - insufficient credit path,
     - disabled customer auth rejection.
   - Add frontend tests for:
     - payment lock when member-priced items need verification,
     - credit payment success and insufficient-credit UX.

---

## Acceptance Criteria

- Customer top-up and credit checkout both produce correct ledger entries.
- No negative balances from checkout debit.
- POS accurately displays total/credit/external split.
- Admin can audit credit history globally and per customer.
- Feature toggle cleanly enables/disables credit-related UX without stale state.
