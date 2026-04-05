import type { Transaction } from "@shared/models";
import { formatPriceMode } from "../../domain/productSection";

type TransactionSummaryPanelProps = {
  transaction: Transaction;
  currencyFormatter: { format(value: number): string };
  checkoutCreditUsed: number;
  checkoutExternalAmount: number;
};

export function TransactionSummaryPanel({
  transaction,
  currencyFormatter,
  checkoutCreditUsed,
  checkoutExternalAmount
}: TransactionSummaryPanelProps): JSX.Element {
  return (
    <aside className="rounded-2xl border border-black/10 bg-white/90 p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
      <h2 className="text-lg font-semibold">This transaction</h2>
      <div className="mt-4 flex flex-col gap-3 text-sm text-slate-600 dark:text-slate-300">
        {transaction.items.map((item) => (
          <div
            key={`${item.productId}-${item.isMemberPrice}`}
            className="flex items-center justify-between"
          >
            <span>
              {item.name} {formatPriceMode(item.isMemberPrice)} x {item.quantity}
            </span>
            <span>{currencyFormatter.format(item.lineTotal)}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 border-t border-black/10 pt-4 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
        {transaction.items.some((item) => item.isMemberPrice) &&
        transaction.items.some((item) => !item.isMemberPrice)
          ? "Mixed pricing applied"
          : transaction.items.some((item) => item.isMemberPrice)
            ? "Member pricing applied"
            : "Regular pricing applied"}
        <div className="mt-3 space-y-1">
          <div>Total: {currencyFormatter.format(transaction.total)}</div>
          <div>Credit: {currencyFormatter.format(checkoutCreditUsed)}</div>
          <div>External: {currencyFormatter.format(checkoutExternalAmount)}</div>
        </div>
      </div>
    </aside>
  );
}
