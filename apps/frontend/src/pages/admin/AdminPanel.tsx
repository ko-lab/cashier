import type { CreditLedgerEntry, Member, Transaction } from "@shared/models";
import type { KeyboardEvent } from "react";

type AdminPanelProps = {
  adminTransactions: Transaction[] | null;
  adminLoading: boolean;
  adminPassword: string;
  setAdminPassword: (value: string) => void;
  loadAdminTransactions: () => void | Promise<void>;
  adminUnlockUsername: string;
  adminTab: "transactions" | "stock" | "members";
  setAdminTab: (value: "transactions" | "stock" | "members") => void;
  memberCreditEnabled: boolean;
  adminTotals: { count: number; completed: number; canceled: number; amount: number };
  hasActiveFilters: boolean;
  lockAdminPanel: () => void;
  downloadAdminCsv: () => void;
  adminFilteredTransactions: Transaction[];
  adminStatusFilter: string;
  onAdminStatusFilterChange: (value: string) => void;
  adminProductFilter: string;
  setAdminProductFilter: (value: string) => void;
  adminProductOptions: { id: string; name: string }[];
  adminItemQuery: string;
  setAdminItemQuery: (value: string) => void;
  adminFromDate: string;
  setAdminFromDate: (value: string) => void;
  adminToDate: string;
  setAdminToDate: (value: string) => void;
  formatAdminDate: (value: string) => string;
  buildCartBreakdownJson: (transaction: Transaction) => string;

  stockSnapshot: any;
  stockProductQuery: string;
  setStockProductQuery: (value: string) => void;
  stockCurrentValueFilter: string;
  setStockCurrentValueFilter: (value: string) => void;
  downloadFilteredStockEventsCsv: () => void;
  filteredStockEvents: any[];
  downloadFilteredStockCountsCsv: () => void;
  filteredStockItems: any[];
  stockDraftByProductId: Record<string, string>;
  setStockDraftByProductId: (updater: (current: Record<string, string>) => Record<string, string>) => void;
  stockRefillByProductId: Record<string, string>;
  setStockRefillByProductId: (updater: (current: Record<string, string>) => Record<string, string>) => void;
  stockNoteByProductId: Record<string, string>;
  setStockNoteByProductId: (updater: (current: Record<string, string>) => Record<string, string>) => void;
  moveStockInputFocus: (event: KeyboardEvent<HTMLInputElement>, direction: 1 | -1) => void;
  isBusy: boolean;
  markStockCountedOk: (productId: string) => void | Promise<void>;
  updateStock: (productId: string) => void | Promise<void>;
  addStockRefill: (productId: string) => void | Promise<void>;

  adminCustomers: Member[];
  selectedMemberId: string;
  setSelectedMemberId: (value: string) => void;
  loadAdminCustomers: (password: string, preferredMemberId?: string) => void | Promise<void>;
  adminSessionPassword: string;
  selectedAdminMember: Member | null;
  adminMemberName: string;
  setAdminMemberName: (value: string) => void;
  adminCustomerType: "member" | "non_member";
  setAdminCustomerType: (value: "member" | "non_member") => void;
  adminMemberPin: string;
  setAdminMemberPin: (value: string) => void;
  createAdminMember: () => void | Promise<void>;
  toggleSelectedMemberActive: () => void | Promise<void>;
  memberTopupAmount: string;
  setMemberTopupAmount: (value: string) => void;
  memberTopupNote: string;
  setMemberTopupNote: (value: string) => void;
  topupSelectedMember: () => void | Promise<void>;
  creditLedger: CreditLedgerEntry[];
  adminCreditEvents: CreditLedgerEntry[];
  currencyFormatter: { format(value: number): string };
  CustomerAutocomplete: any;
};

export function AdminPanel(props: AdminPanelProps): JSX.Element {
  const {
    adminTransactions,
    adminLoading,
    adminPassword,
    setAdminPassword,
    loadAdminTransactions,
    adminUnlockUsername,
    adminTab,
    setAdminTab,
    memberCreditEnabled,
    adminTotals,
    hasActiveFilters,
    lockAdminPanel,
    downloadAdminCsv,
    adminFilteredTransactions,
    adminStatusFilter,
    onAdminStatusFilterChange,
    adminProductFilter,
    setAdminProductFilter,
    adminProductOptions,
    adminItemQuery,
    setAdminItemQuery,
    adminFromDate,
    setAdminFromDate,
    adminToDate,
    setAdminToDate,
    formatAdminDate,
    buildCartBreakdownJson,
    stockSnapshot,
    stockProductQuery,
    setStockProductQuery,
    stockCurrentValueFilter,
    setStockCurrentValueFilter,
    downloadFilteredStockEventsCsv,
    filteredStockEvents,
    downloadFilteredStockCountsCsv,
    filteredStockItems,
    stockDraftByProductId,
    setStockDraftByProductId,
    stockRefillByProductId,
    setStockRefillByProductId,
    stockNoteByProductId,
    setStockNoteByProductId,
    moveStockInputFocus,
    isBusy,
    markStockCountedOk,
    updateStock,
    addStockRefill,
    adminCustomers,
    selectedMemberId,
    setSelectedMemberId,
    loadAdminCustomers,
    adminSessionPassword,
    selectedAdminMember,
    adminMemberName,
    setAdminMemberName,
    adminCustomerType,
    setAdminCustomerType,
    adminMemberPin,
    setAdminMemberPin,
    createAdminMember,
    toggleSelectedMemberActive,
    memberTopupAmount,
    setMemberTopupAmount,
    memberTopupNote,
    setMemberTopupNote,
    topupSelectedMember,
    creditLedger,
    adminCreditEvents,
    currencyFormatter,
    CustomerAutocomplete
  } = props;

  return (
    <>
      {!adminTransactions ? (
        <form
          className="mx-auto flex w-full max-w-md flex-col gap-4"
          autoComplete="on"
          onSubmit={(event) => {
            event.preventDefault();
            void loadAdminTransactions();
          }}
        >
          <h2 className="text-lg font-semibold">Unlock admin panel</h2>
          <p className="text-sm text-slate-500 dark:text-slate-300">
            Submit the admin password to access transaction history, stock management,
            and CSV export.
          </p>
          <input type="text" name="admin_unlock_user" value={adminUnlockUsername} readOnly autoComplete="username" tabIndex={-1} aria-hidden="true" className="hidden" />
          <input
            type="password"
            name="admin_unlock_password"
            value={adminPassword}
            onChange={(event) => setAdminPassword(event.target.value)}
            placeholder="Admin password"
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
            autoComplete="current-password"
          />
          <button type="submit" disabled={adminLoading || adminPassword.length === 0} className="rounded-xl bg-accent-light px-4 py-3 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-accent-dark dark:text-slate-900">
            {adminLoading ? "Unlocking..." : "Login"}
          </button>
        </form>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex gap-2">
            <button type="button" onClick={() => setAdminTab("transactions")} className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${adminTab === "transactions" ? "bg-accent-light text-white dark:bg-accent-dark dark:text-slate-900" : "border border-slate-300 hover:border-slate-500 dark:border-slate-600"}`}>Transactions</button>
            <button type="button" onClick={() => setAdminTab("stock")} className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${adminTab === "stock" ? "bg-accent-light text-white dark:bg-accent-dark dark:text-slate-900" : "border border-slate-300 hover:border-slate-500 dark:border-slate-600"}`}>Stock</button>
            {memberCreditEnabled && <button type="button" onClick={() => setAdminTab("members")} className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${adminTab === "members" ? "bg-accent-light text-white dark:bg-accent-dark dark:text-slate-900" : "border border-slate-300 hover:border-slate-500 dark:border-slate-600"}`}>Customers</button>}
          </div>

          {adminTab === "transactions" && (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"><p className="text-xs uppercase tracking-wide text-slate-500">Transactions{hasActiveFilters && <span className="ml-1 normal-case tracking-normal text-slate-400">(Filtered)</span>}</p><p className="mt-2 text-xl font-semibold">{adminTotals.count}</p></div>
                <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"><p className="text-xs uppercase tracking-wide text-slate-500">Completed{hasActiveFilters && <span className="ml-1 normal-case tracking-normal text-slate-400">(Filtered)</span>}</p><p className="mt-2 text-xl font-semibold">{adminTotals.completed}</p></div>
                <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"><p className="text-xs uppercase tracking-wide text-slate-500">Canceled{hasActiveFilters && <span className="ml-1 normal-case tracking-normal text-slate-400">(Filtered)</span>}</p><p className="mt-2 text-xl font-semibold">{adminTotals.canceled}</p></div>
                <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"><p className="text-xs uppercase tracking-wide text-slate-500">Amount{hasActiveFilters && <span className="ml-1 normal-case tracking-normal text-slate-400">(Filtered)</span>}</p><p className="mt-2 text-xl font-semibold">{currencyFormatter.format(adminTotals.amount)}</p></div>
              </div>

              <div className="flex justify-end gap-3">
                <button type="button" onClick={lockAdminPanel} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold transition hover:border-slate-500 dark:border-slate-600">Refresh</button>
                <button type="button" onClick={downloadAdminCsv} disabled={adminFilteredTransactions.length === 0} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600">Download CSV (filtered)</button>
              </div>

              <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-7">
                <label className="flex flex-col gap-2 text-sm"><span className="text-xs uppercase tracking-wide text-slate-500">Status</span><select value={adminStatusFilter} onChange={(event) => onAdminStatusFilterChange(event.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-700 outline-none transition focus:border-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"><option value="all">All</option><option value="pending">Pending</option><option value="completed">Completed</option><option value="canceled">Canceled</option><option value="abandoned">Abandoned</option></select></label>
                <label className="flex flex-col gap-2 text-sm"><span className="text-xs uppercase tracking-wide text-slate-500">Product</span><select value={adminProductFilter} onChange={(event) => setAdminProductFilter(event.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-700 outline-none transition focus:border-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"><option value="all">All</option>{adminProductOptions.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
                <label className="flex flex-col gap-2 text-sm"><span className="text-xs uppercase tracking-wide text-slate-500">Item text</span><input type="search" value={adminItemQuery} onChange={(event) => setAdminItemQuery(event.target.value)} placeholder="Name or id" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-700 outline-none transition focus:border-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200" /></label>
                <label className="flex flex-col gap-2 text-sm"><span className="text-xs uppercase tracking-wide text-slate-500">From</span><input type="date" value={adminFromDate} onChange={(event) => setAdminFromDate(event.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-700 outline-none transition focus:border-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200" /></label>
                <label className="flex flex-col gap-2 text-sm"><span className="text-xs uppercase tracking-wide text-slate-500">To</span><input type="date" value={adminToDate} onChange={(event) => setAdminToDate(event.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-700 outline-none transition focus:border-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200" /></label>
                <div className="flex items-end"><button type="button" onClick={() => { const today = new Date(); const to = today.toISOString().slice(0, 10); const from = new Date(Date.now() - 24 * 60 * 60 * 1000); setAdminFromDate(from.toISOString().slice(0, 10)); setAdminToDate(to); }} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm transition hover:border-slate-500 dark:border-slate-600">Last 24h</button></div>
                <div className="flex items-end"><button type="button" onClick={() => { onAdminStatusFilterChange("all"); setAdminProductFilter("all"); setAdminItemQuery(""); setAdminFromDate(""); setAdminToDate(""); }} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm transition hover:border-slate-500 dark:border-slate-600">Reset filters</button></div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
                  <thead className="bg-slate-50 dark:bg-slate-800/40"><tr><th className="px-3 py-2 text-left font-semibold">ID</th><th className="px-3 py-2 text-left font-semibold">Date</th><th className="px-3 py-2 text-left font-semibold">Type</th><th className="px-3 py-2 text-left font-semibold">Status</th><th className="px-3 py-2 text-right font-semibold">Total</th><th className="px-3 py-2 text-left font-semibold">Items</th></tr></thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {adminFilteredTransactions.map((entry) => (
                      <tr key={entry.id}>
                        <td className="max-w-28 truncate px-3 py-2 font-mono text-xs" title={entry.id}>{entry.id}</td>
                        <td className="whitespace-nowrap px-3 py-2">{formatAdminDate(entry.createdAt)}</td>
                        <td className="whitespace-nowrap px-3 py-2">{entry.type === "credit_topup" ? "credit_topup" : "sale"}</td>
                        <td className="whitespace-nowrap px-3 py-2">{entry.status}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right">{currencyFormatter.format(entry.total)}</td>
                        <td className="px-3 py-2 text-left font-mono text-xs">{buildCartBreakdownJson(entry)}</td>
                      </tr>
                    ))}
                    {adminFilteredTransactions.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-500 dark:text-slate-300">No transactions match current filters.</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {memberCreditEnabled && adminTab === "members" && (
            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <h3 className="text-sm font-semibold">Customers</h3>
              <CustomerAutocomplete className="mt-3" customers={adminCustomers} selectedCustomerId={selectedMemberId} onSelectCustomer={(member: Member | null) => { const nextMemberId = member?.id ?? ""; setSelectedMemberId(nextMemberId); if (nextMemberId) { void loadAdminCustomers(adminSessionPassword, nextMemberId); } }} placeholder="Search customer" noResultsText="No customers found." />
              {selectedAdminMember && <div className="mt-3 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700"><div className="flex items-center justify-between"><span className="font-medium">{selectedAdminMember.displayName}</span><span>{currencyFormatter.format(selectedAdminMember.balance)}</span></div></div>}
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <input type="text" value={adminMemberName} onChange={(event) => setAdminMemberName(event.target.value)} placeholder="Display name" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200" />
                <select value={adminCustomerType} onChange={(event) => setAdminCustomerType(event.target.value as "member" | "non_member")} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"><option value="member">Member customer</option><option value="non_member">Non-member customer</option></select>
                <input type="text" inputMode="numeric" value={adminMemberPin} onChange={(event) => setAdminMemberPin(event.target.value.replace(/\D+/g, ""))} placeholder="PIN (4+ digits)" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200" />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => void createAdminMember()} className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95 disabled:opacity-50" disabled={adminLoading}>Add customer</button>
                <button type="button" onClick={() => void toggleSelectedMemberActive()} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold transition hover:border-slate-500 dark:border-slate-600">Toggle active</button>
                <input type="number" min={0.01} step="0.01" value={memberTopupAmount} onChange={(event) => setMemberTopupAmount(event.target.value)} placeholder="Top-up amount" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200" />
                <input type="text" value={memberTopupNote} onChange={(event) => setMemberTopupNote(event.target.value)} placeholder="Note (optional)" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200" />
                <button type="button" onClick={() => void topupSelectedMember()} className="rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-white transition hover:brightness-95 disabled:opacity-50" disabled={adminLoading}>Top up credit</button>
              </div>
              <ul className="mt-3 space-y-1 text-sm">{creditLedger.map((entry) => <li key={entry.id} className="flex items-center justify-between gap-2"><span className="truncate text-slate-600 dark:text-slate-300">{formatAdminDate(entry.createdAt)} • {entry.reason}</span><span className={entry.delta >= 0 ? "text-emerald-500" : "text-rose-500"}>{entry.delta >= 0 ? "+" : ""}{currencyFormatter.format(entry.delta)}</span></li>)}</ul>
              <div className="mt-3 text-xs text-slate-500">Global credit events: {adminCreditEvents.length}</div>
            </div>
          )}

          {adminTab === "stock" && stockSnapshot && (
            <div className="flex flex-col gap-4">
              <div className="grid gap-3 md:grid-cols-4">
                <label className="flex flex-col gap-2 text-sm"><span className="text-xs uppercase tracking-wide text-slate-500">Product</span><input type="search" value={stockProductQuery} onChange={(event) => setStockProductQuery(event.target.value)} placeholder="Name or id" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-700 outline-none transition focus:border-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200" /></label>
                <label className="flex flex-col gap-2 text-sm"><span className="text-xs uppercase tracking-wide text-slate-500">Current value</span><input type="text" inputMode="numeric" pattern="-?[0-9]*" value={stockCurrentValueFilter} onChange={(event) => { const next = event.target.value; if (!/^-?\d*$/.test(next)) return; setStockCurrentValueFilter(next); }} placeholder="Exact quantity" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-700 outline-none transition focus:border-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200" /></label>
                <div className="flex items-end"><button type="button" onClick={downloadFilteredStockEventsCsv} disabled={filteredStockEvents.length === 0} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600">Export stock events CSV</button></div>
                <div className="flex items-end"><button type="button" onClick={downloadFilteredStockCountsCsv} disabled={filteredStockItems.length === 0} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600">Export current stock CSV</button></div>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700"><table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700"><thead className="bg-slate-50 dark:bg-slate-800/40"><tr><th className="px-3 py-2 text-left font-semibold">Product</th><th className="px-3 py-2 text-right font-semibold">Current</th><th className="px-3 py-2 text-right font-semibold">Set stock</th><th className="px-3 py-2 text-right font-semibold">Refill (+)</th><th className="px-3 py-2 text-left font-semibold">Note</th><th className="px-3 py-2 text-right font-semibold">Action</th></tr></thead><tbody className="divide-y divide-slate-200 dark:divide-slate-700">{filteredStockItems.map((item: any) => (<tr key={item.productId}><td className="px-3 py-2">{item.productName}</td><td className="px-3 py-2 text-right font-semibold">{item.quantity}</td><td className="px-3 py-2 text-right"><input type="text" inputMode="numeric" pattern="-?[0-9]*" data-stock-input="true" placeholder={String(item.quantity)} value={stockDraftByProductId[item.productId] ?? ""} onKeyDown={(event) => { if (event.key === "ArrowDown") moveStockInputFocus(event, 1); if (event.key === "ArrowUp") moveStockInputFocus(event, -1); }} onChange={(event) => { const nextValue = event.target.value; if (!/^-?\d*$/.test(nextValue)) return; setStockDraftByProductId((current) => ({ ...current, [item.productId]: nextValue })); }} className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-right dark:border-slate-600 dark:bg-slate-900" /></td><td className="px-3 py-2 text-right"><input type="text" inputMode="numeric" pattern="[0-9]*" placeholder="0" value={stockRefillByProductId[item.productId] ?? ""} onChange={(event) => { const nextValue = event.target.value; if (!/^\d*$/.test(nextValue)) return; setStockRefillByProductId((current) => ({ ...current, [item.productId]: nextValue })); }} className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-right dark:border-slate-600 dark:bg-slate-900" /></td><td className="px-3 py-2"><input type="text" value={stockNoteByProductId[item.productId] ?? ""} placeholder="Comment" onChange={(event) => { const nextValue = event.target.value; if (/[;,]/.test(nextValue)) return; setStockNoteByProductId((current) => ({ ...current, [item.productId]: nextValue })); }} className="w-full rounded-lg border border-slate-300 px-2 py-1 dark:border-slate-600 dark:bg-slate-900" /></td><td className="px-3 py-2 text-right"><div className="flex justify-end gap-2"><button type="button" onClick={() => void markStockCountedOk(item.productId)} disabled={isBusy} className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600">Counted OK</button><button type="button" onClick={() => void updateStock(item.productId)} disabled={isBusy} className="rounded-lg bg-accent-light px-3 py-1 text-xs font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-accent-dark dark:text-slate-900">Set stock</button><button type="button" onClick={() => void addStockRefill(item.productId)} disabled={isBusy} className="rounded-lg bg-emerald-500 px-3 py-1 text-xs font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40">Add refill</button></div></td></tr>))}</tbody></table></div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
