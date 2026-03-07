import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode-svg";
import { client } from "./api/client";
import type {
  PriceCategory,
  Product,
  Transaction,
  TransactionStatus
} from "@shared/models";
import {
  buildCartSummary,
  sortProducts,
  toTransactionItems,
  updateCartQuantity
} from "./domain/cart";
import {
  filterProductsByQuery,
  formatPriceMode,
  getSelectedItems,
  getUnselectedProducts
} from "./domain/productSection";
import { getUnitPrice } from "./domain/pricing";

type View = "cart" | "checkout";
type UiMode = "pos" | "admin";

type StatusMessage = {
  tone: "error" | "info";
  text: string;
};

const currencyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "EUR"
});

export default function App() {
  const [uiMode, setUiMode] = useState<UiMode>("pos");
  const [products, setProducts] = useState<Product[]>([]);
  const [priceCategories, setPriceCategories] = useState<PriceCategory[]>([]);
  const [cart, setCart] = useState<
    { productId: string; quantity: number; isMemberPrice: boolean }[]
  >([]);
  const [defaultIsMemberPrice, setDefaultIsMemberPrice] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [view, setView] = useState<View>("cart");
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [loading, setLoading] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [adminTransactions, setAdminTransactions] = useState<Transaction[] | null>(
    null
  );
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminStatusFilter, setAdminStatusFilter] = useState<
    "all" | TransactionStatus
  >("all");
  const [adminFromDate, setAdminFromDate] = useState("");
  const [adminToDate, setAdminToDate] = useState("");
  const [isDark, setIsDark] = useState(() => {
    const stored = localStorage.getItem("theme");
    return stored ? stored === "dark" : false;
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    localStorage.setItem("theme", isDark ? "dark" : "light");
  }, [isDark]);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    client.product
      .list()
      .then((data) => {
        if (isMounted) {
          setProducts(sortProducts(Object.values(data.products)));
          setPriceCategories(Object.values(data.priceCategories));
          setStatus(null);
        }
      })
      .catch(() => {
        if (isMounted) {
          setStatus({ tone: "error", text: "Failed to load products." });
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const summary = useMemo(
    () => buildCartSummary(products, priceCategories, cart),
    [products, priceCategories, cart]
  );

  const filteredProducts = useMemo(
    () => filterProductsByQuery(products, searchQuery),
    [products, searchQuery]
  );

  const selectedCartItems = useMemo(
    () => getSelectedItems(products, priceCategories, cart, searchQuery),
    [products, priceCategories, cart, searchQuery]
  );

  const unselectedFilteredProducts = useMemo(
    () => getUnselectedProducts(products, cart, searchQuery, defaultIsMemberPrice),
    [products, cart, searchQuery, defaultIsMemberPrice]
  );

  useEffect(() => {
    if (!transaction) {
      setQrSvg(null);
      return;
    }

    const ibanName = import.meta.env.VITE_IBAN_NAME ?? "KO-LAB";
    const ibanNumber = import.meta.env.VITE_IBAN ?? "BE00000000000000";
    const payMessage = transaction.id;
    const amount = transaction.total.toFixed(2);
    const payload = [
      "BCD",
      "002",
      "1",
      "SCT",
      "",
      `${ibanName}`,
      `${ibanNumber}`,
      `EUR${amount}`,
      "",
      "",
      payMessage.substring(0, 100),
      ""
    ].join("\n");

    const qr = new QRCode({
      content: payload,
      padding: 4,
      width: 256,
      height: 256,
      color: "#000000",
      background: "#ffffff",
      ecl: "H"
    });

    setQrSvg(qr.svg());
  }, [transaction]);

  const handleQuantityChange = (
    productId: string,
    delta: number,
    isMemberPrice: boolean
  ) => {
    setCart((current) =>
      updateCartQuantity(current, productId, delta, isMemberPrice)
    );
  };

  const startCheckout = async () => {
    setStatus(null);
    setLoading(true);

    try {
      const response = await client.transaction.start({
        items: toTransactionItems(cart)
      });
      setTransaction(response);
      setView("checkout");
    } catch {
      setStatus({ tone: "error", text: "Could not start transaction." });
    } finally {
      setLoading(false);
    }
  };

  const finalize = async (status: "completed" | "canceled") => {
    if (!transaction) {
      return;
    }

    setLoading(true);
    try {
      await client.transaction.finalize({ id: transaction.id, status });
      setCart([]);
      setTransaction(null);
      setView("cart");
      setStatus({
        tone: "info",
        text: status === "completed" ? "Thanks for paying!" : "Transaction cancelled."
      });
    } catch {
      setStatus({ tone: "error", text: "Could not update transaction." });
    } finally {
      setLoading(false);
    }
  };

  const totalLabel = currencyFormatter.format(summary.total);
  const adminFilteredTransactions = useMemo(() => {
    if (!adminTransactions) {
      return [];
    }

    return adminTransactions.filter((transaction) => {
      if (
        adminStatusFilter !== "all" &&
        transaction.status !== adminStatusFilter
      ) {
        return false;
      }

      const date = new Date(transaction.createdAt);
      if (!Number.isFinite(date.getTime())) {
        return false;
      }

      if (adminFromDate) {
        const fromDate = new Date(`${adminFromDate}T00:00:00.000Z`);
        if (date < fromDate) {
          return false;
        }
      }

      if (adminToDate) {
        const toDate = new Date(`${adminToDate}T23:59:59.999Z`);
        if (date > toDate) {
          return false;
        }
      }

      return true;
    });
  }, [adminTransactions, adminStatusFilter, adminFromDate, adminToDate]);

  const adminTotals = useMemo(() => {
    return adminFilteredTransactions.reduce(
      (accumulator, transaction) => {
        accumulator.count += 1;
        accumulator.amount += transaction.total;
        accumulator[transaction.status] += 1;
        return accumulator;
      },
      { count: 0, amount: 0, pending: 0, completed: 0, canceled: 0 }
    );
  }, [adminFilteredTransactions]);

  const isBusy = loading || adminLoading;

  const getQuantity = (productId: string, isMemberPrice: boolean) =>
    cart.find(
      (item) =>
        item.productId === productId && item.isMemberPrice === isMemberPrice
    )?.quantity ?? 0;

  const loadAdminTransactions = async () => {
    setAdminError(null);
    setAdminLoading(true);
    try {
      const response = await client.admin.exportTransactions({
        password: adminPassword
      });
      setAdminTransactions(response.transactions);
      setAdminPassword("");
      setAdminStatusFilter("all");
      setAdminFromDate("");
      setAdminToDate("");
    } catch {
      setAdminError("Invalid password or admin panel unavailable.");
    } finally {
      setAdminLoading(false);
    }
  };

  const lockAdminPanel = () => {
    setAdminTransactions(null);
    setAdminPassword("");
    setAdminError(null);
    setAdminStatusFilter("all");
    setAdminFromDate("");
    setAdminToDate("");
  };

  return (
    <div className="min-h-screen px-6 py-8">
      <div className="mx-auto flex max-w-4xl flex-col gap-8">
        <header className="flex flex-col gap-4 rounded-2xl border border-black/10 bg-white/70 p-6 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-slate-500 dark:text-slate-300">
                KO-LAB {uiMode === "pos" ? "POS" : "ADMIN"}
              </p>
              <h1 className="text-2xl font-semibold">
                {uiMode === "pos" ? "Fridge Checkout" : "Stupid Admin Panel"}
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setUiMode((current) => (current === "pos" ? "admin" : "pos"));
                  setAdminError(null);
                }}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm transition hover:border-slate-500 dark:border-slate-600 dark:hover:border-slate-300"
              >
                {uiMode === "pos" ? "Open admin panel" : "Back to checkout"}
              </button>
              <button
                type="button"
                onClick={() => setIsDark((value) => !value)}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm transition hover:border-slate-500 dark:border-slate-600 dark:hover:border-slate-300"
              >
                {isDark ? "Light mode" : "Dark mode"}
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="text-sm text-slate-500 dark:text-slate-300">
              {isBusy ? "Loading..." : "Ready"}
            </div>
            {uiMode === "admin" && adminTransactions && (
              <button
                type="button"
                onClick={lockAdminPanel}
                className="rounded-full border border-slate-300 px-4 py-2 text-xs uppercase tracking-wide text-slate-600 transition hover:border-slate-500 dark:border-slate-600 dark:text-slate-300"
              >
                Lock admin panel
              </button>
            )}
          </div>
          {uiMode === "pos" && status && (
            <div
              className={`rounded-lg px-4 py-2 text-sm ${
                status.tone === "error"
                  ? "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200"
                  : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200"
              }`}
            >
              {status.text}
            </div>
          )}
          {uiMode === "admin" && adminError && (
            <div className="rounded-lg bg-rose-100 px-4 py-2 text-sm text-rose-700 dark:bg-rose-500/20 dark:text-rose-200">
              {adminError}
            </div>
          )}
        </header>

        {uiMode === "admin" ? (
          <section className="rounded-2xl border border-black/10 bg-white/80 p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
            {!adminTransactions ? (
              <form
                className="mx-auto flex w-full max-w-md flex-col gap-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void loadAdminTransactions();
                }}
              >
                <h2 className="text-lg font-semibold">Unlock transaction export</h2>
                <p className="text-sm text-slate-500 dark:text-slate-300">
                  Submit admin password to retrieve `transactions.json` in-memory.
                </p>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(event) => setAdminPassword(event.target.value)}
                  placeholder="Admin password"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                  autoComplete="current-password"
                />
                <button
                  type="submit"
                  disabled={adminLoading || adminPassword.length === 0}
                  className="rounded-xl bg-accent-light px-4 py-3 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-accent-dark dark:text-slate-900"
                >
                  {adminLoading ? "Unlocking..." : "Load transactions"}
                </button>
              </form>
            ) : (
              <div className="flex flex-col gap-6">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Total tx</p>
                    <p className="mt-2 text-xl font-semibold">{adminTotals.count}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Completed
                    </p>
                    <p className="mt-2 text-xl font-semibold">{adminTotals.completed}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Canceled</p>
                    <p className="mt-2 text-xl font-semibold">{adminTotals.canceled}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Total amount
                    </p>
                    <p className="mt-2 text-xl font-semibold">
                      {currencyFormatter.format(adminTotals.amount)}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-4">
                  <label className="flex flex-col gap-2 text-sm">
                    <span className="text-xs uppercase tracking-wide text-slate-500">
                      Status
                    </span>
                    <select
                      value={adminStatusFilter}
                      onChange={(event) =>
                        setAdminStatusFilter(
                          event.target.value as "all" | TransactionStatus
                        )
                      }
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-700 outline-none transition focus:border-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                    >
                      <option value="all">All</option>
                      <option value="pending">Pending</option>
                      <option value="completed">Completed</option>
                      <option value="canceled">Canceled</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-2 text-sm">
                    <span className="text-xs uppercase tracking-wide text-slate-500">
                      From
                    </span>
                    <input
                      type="date"
                      value={adminFromDate}
                      onChange={(event) => setAdminFromDate(event.target.value)}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-700 outline-none transition focus:border-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                    />
                  </label>
                  <label className="flex flex-col gap-2 text-sm">
                    <span className="text-xs uppercase tracking-wide text-slate-500">To</span>
                    <input
                      type="date"
                      value={adminToDate}
                      onChange={(event) => setAdminToDate(event.target.value)}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-700 outline-none transition focus:border-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                    />
                  </label>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => {
                        setAdminStatusFilter("all");
                        setAdminFromDate("");
                        setAdminToDate("");
                      }}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm transition hover:border-slate-500 dark:border-slate-600"
                    >
                      Reset filters
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                  <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
                    <thead className="bg-slate-50 dark:bg-slate-800/40">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold">ID</th>
                        <th className="px-3 py-2 text-left font-semibold">Date</th>
                        <th className="px-3 py-2 text-left font-semibold">Status</th>
                        <th className="px-3 py-2 text-right font-semibold">Total</th>
                        <th className="px-3 py-2 text-right font-semibold">Items</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                      {adminFilteredTransactions.map((entry) => (
                        <tr key={entry.id}>
                          <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">
                            {entry.id}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2">
                            {new Date(entry.createdAt).toLocaleString()}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2">{entry.status}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-right">
                            {currencyFormatter.format(entry.total)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-right">
                            {entry.items.length}
                          </td>
                        </tr>
                      ))}
                      {adminFilteredTransactions.length === 0 && (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-3 py-6 text-center text-slate-500 dark:text-slate-300"
                          >
                            No transactions match current filters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        ) : view === "cart" ? (
          <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
            <div className="rounded-2xl border border-black/10 bg-white/80 p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-lg font-semibold">Products</h2>
                <div className="flex items-center gap-3 rounded-full border border-slate-200 px-3 py-1 text-xs uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:text-slate-200">
                  <span>{defaultIsMemberPrice ? "Member price" : "Regular price"}</span>
                  <button
                    type="button"
                    onClick={() => setDefaultIsMemberPrice((value) => !value)}
                    className={`relative h-6 w-12 rounded-full transition ${
                      defaultIsMemberPrice
                        ? "bg-accent-light dark:bg-accent-dark"
                        : "bg-slate-300 dark:bg-slate-700"
                    }`}
                    aria-pressed={defaultIsMemberPrice}
                  >
                    <span
                      className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${
                        defaultIsMemberPrice ? "left-7" : "left-1"
                      }`}
                    />
                  </button>
                </div>
              </div>
              <div className="mt-4">
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search products"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                />
              </div>
              <div className="mt-4 flex flex-col gap-4">
                {selectedCartItems.length > 0 && (
                  <div className="rounded-xl border border-dashed border-slate-400/60 px-4 py-3 dark:border-slate-500">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-300">
                      Selected
                    </p>
                    <div className="mt-3 flex flex-col gap-4">
                      {selectedCartItems.map((item) => (
                        <div
                          key={`${item.productId}-${item.isMemberPrice}`}
                          className="flex flex-wrap items-center justify-between gap-3 border-b border-black/5 pb-3 last:border-b-0 dark:border-white/10"
                        >
                          <div>
                            <p className="font-medium">
                              {item.name}{" "}
                              <span className="text-xs uppercase text-slate-500">
                                {formatPriceMode(item.isMemberPrice)}
                              </span>
                            </p>
                            <p className="text-sm text-slate-500 dark:text-slate-300">
                              {currencyFormatter.format(item.unitPrice)} - stock{" "}
                              {item.inventoryCount}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() =>
                                handleQuantityChange(
                                  item.productId,
                                  -1,
                                  item.isMemberPrice
                                )
                              }
                              className="h-8 w-8 rounded-full border border-slate-300 text-lg transition hover:border-slate-500 dark:border-slate-600"
                            >
                              -
                            </button>
                            <span className="w-6 text-center text-sm font-semibold">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                handleQuantityChange(
                                  item.productId,
                                  1,
                                  item.isMemberPrice
                                )
                              }
                              className="h-8 w-8 rounded-full border border-slate-300 text-lg transition hover:border-slate-500 dark:border-slate-600"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {unselectedFilteredProducts.length === 0 &&
                  selectedCartItems.length === 0 && (
                  <p className="text-sm text-slate-500">
                    {products.length === 0
                      ? "No products configured."
                      : "No products match search."}
                  </p>
                )}
                {unselectedFilteredProducts.map((product) => {
                  const unitPrice = getUnitPrice(
                    product,
                    priceCategories,
                    defaultIsMemberPrice
                  );
                  const quantity = getQuantity(product.id, defaultIsMemberPrice);

                  return (
                    <div
                      key={product.id}
                      className="flex flex-wrap items-center justify-between gap-3 border-b border-black/5 pb-3 last:border-b-0 dark:border-white/10"
                    >
                      <div>
                        <p className="font-medium">
                          {product.name}{" "}
                          <span className="text-xs uppercase text-slate-500">
                            {formatPriceMode(defaultIsMemberPrice)}
                          </span>
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-300">
                          {currencyFormatter.format(unitPrice)} - stock{" "}
                          {product.inventoryCount}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            handleQuantityChange(product.id, -1, defaultIsMemberPrice)
                          }
                          className="h-8 w-8 rounded-full border border-slate-300 text-lg transition hover:border-slate-500 dark:border-slate-600"
                        >
                          -
                        </button>
                        <span className="w-6 text-center text-sm font-semibold">{quantity}</span>
                        <button
                          type="button"
                          onClick={() =>
                            handleQuantityChange(product.id, 1, defaultIsMemberPrice)
                          }
                          className="h-8 w-8 rounded-full border border-slate-300 text-lg transition hover:border-slate-500 dark:border-slate-600"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <aside className="flex flex-col gap-4 rounded-2xl border border-black/10 bg-white/90 p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
              <h2 className="text-lg font-semibold">Summary</h2>
              <div className="flex flex-col gap-3 text-sm text-slate-600 dark:text-slate-300">
                {summary.items.length === 0 && <span>No items selected.</span>}
                {summary.items.map((item) => (
                  <div
                    key={`${item.productId}-${item.isMemberPrice}`}
                    className="flex items-center justify-between"
                  >
                    <span>
                      {item.name} {formatPriceMode(item.isMemberPrice)} x{" "}
                      {item.quantity}
                    </span>
                    <span>{currencyFormatter.format(item.lineTotal)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-black/10 pt-4 text-lg font-semibold dark:border-white/10">
                <span>Total</span>
                <span>{totalLabel}</span>
              </div>
              <button
                type="button"
                onClick={startCheckout}
                disabled={summary.items.length === 0 || isBusy}
                className="mt-2 rounded-xl bg-accent-light px-4 py-3 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-accent-dark dark:text-slate-900"
              >
                Show QR + Pay
              </button>
            </aside>
          </section>
        ) : (
          <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
            <div className="rounded-2xl border border-black/10 bg-white/80 p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
              <h2 className="text-lg font-semibold">Pay at the fridge</h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
                Scan the QR code and pay the total. When done, press "I paid".
              </p>
              <div className="mt-6 flex flex-col items-center gap-4 rounded-2xl border border-dashed border-slate-400/60 p-6 dark:border-slate-500">
                {qrSvg ? (
                  <div
                    className="h-56 w-56"
                    aria-label="Payment QR"
                    dangerouslySetInnerHTML={{ __html: qrSvg }}
                  />
                ) : (
                  <div className="h-56 w-56 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-700" />
                )}
                <div className="text-center">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                    Amount due
                  </p>
                  <p className="text-2xl font-semibold">{totalLabel}</p>
                </div>
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => finalize("completed")}
                  disabled={isBusy}
                  className="rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:brightness-95 disabled:opacity-50"
                >
                  I paid
                </button>
                <button
                  type="button"
                  onClick={() => finalize("canceled")}
                  disabled={isBusy}
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-500 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200"
                >
                  Cancel
                </button>
              </div>
            </div>
            <aside className="rounded-2xl border border-black/10 bg-white/90 p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
              <h2 className="text-lg font-semibold">This transaction</h2>
              <div className="mt-4 flex flex-col gap-3 text-sm text-slate-600 dark:text-slate-300">
                {transaction?.items.map((item) => (
                  <div
                    key={`${item.productId}-${item.isMemberPrice}`}
                    className="flex items-center justify-between"
                  >
                    <span>
                      {item.name} {formatPriceMode(item.isMemberPrice)} x{" "}
                      {item.quantity}
                    </span>
                    <span>{currencyFormatter.format(item.lineTotal)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 border-t border-black/10 pt-4 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                {transaction?.items.some((item) => item.isMemberPrice) &&
                transaction?.items.some((item) => !item.isMemberPrice)
                  ? "Mixed pricing applied"
                  : transaction?.items.some((item) => item.isMemberPrice)
                    ? "Member pricing applied"
                    : "Regular pricing applied"}
              </div>
            </aside>
          </section>
        )}
      </div>
    </div>
  );
}
