import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode-svg";
import { client } from "./api/client";
import type {
  AdminGetStockOutput,
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
  getSelectedItems
} from "./domain/productSection";
import { getUnitPrice } from "./domain/pricing";
import { toStructuredCommunication } from "./domain/structuredCommunication";

type View = "cart" | "checkout";
type UiMode = "pos" | "admin";
type AdminTab = "transactions" | "stock";

type StatusMessage = {
  tone: "error" | "info";
  text: string;
};

type VersionPayload = {
  version?: string;
};

const QR_SIZE = 224;
const VERSION_CHECK_INTERVAL_MS = 60_000;
const APP_VERSION =
  (import.meta.env.VITE_APP_VERSION as string | undefined) ?? "dev";

const currencyFormatter =
  typeof Intl !== "undefined" && typeof Intl.NumberFormat === "function"
    ? new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: "EUR"
      })
    : {
        format(value: number) {
          return `EUR ${value.toFixed(2)}`;
        }
      };

function scrollToTop(): void {
  if (typeof window !== "undefined") {
    window.scrollTo(0, 0);
  }
}

function readStoredTheme(): boolean {
  try {
    const stored = localStorage.getItem("theme");
    return stored ? stored === "dark" : false;
  } catch {
    return false;
  }
}

function persistTheme(isDark: boolean): void {
  try {
    localStorage.setItem("theme", isDark ? "dark" : "light");
  } catch {
    // Ignore storage failures (e.g., old/private Safari)
  }
}

function csvEscape(value: string | number | boolean): string {
  const text = String(value);
  if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }
  return text;
}

function buildTransactionsCsv(transactions: Transaction[]): string {
  const header = [
    "id",
    "createdAt",
    "status",
    "total",
    "itemCount",
    "items"
  ];
  const lines = transactions.map((transaction) => {
    const itemsSummary = transaction.items
      .map((item) => `${item.name} x${item.quantity}`)
      .join(" | ");
    return [
      transaction.id,
      transaction.createdAt,
      transaction.status,
      transaction.total.toFixed(2),
      transaction.items.length,
      itemsSummary
    ]
      .map(csvEscape)
      .join(",");
  });
  return [header.join(","), ...lines].join("\n");
}

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
  const [qrImageSrc, setQrImageSrc] = useState<string | null>(null);
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
  const [adminProductFilter, setAdminProductFilter] = useState("all");
  const [adminFromDate, setAdminFromDate] = useState("");
  const [adminToDate, setAdminToDate] = useState("");
  const [adminTab, setAdminTab] = useState<AdminTab>("transactions");
  const [adminSessionPassword, setAdminSessionPassword] = useState("");
  const [stockSnapshot, setStockSnapshot] = useState<AdminGetStockOutput | null>(null);
  const [stockDraftByProductId, setStockDraftByProductId] = useState<Record<string, string>>({});
  const [stockNoteByProductId, setStockNoteByProductId] = useState<Record<string, string>>({});
  const [isDark, setIsDark] = useState(readStoredTheme);
  const [updateReady, setUpdateReady] = useState(false);
  const [showCheckoutConfirm, setShowCheckoutConfirm] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    persistTheme(isDark);
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
      .catch((error: unknown) => {
        if (isMounted) {
          const message =
            error instanceof Error ? error.message : String(error);
          setStatus({
            tone: "error",
            text: `Failed to load products: ${message}`
          });
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

  const cartItemsForCheckout = useMemo(
    () => getSelectedItems(products, priceCategories, cart, ""),
    [products, priceCategories, cart]
  );

  const structuredCommunication = useMemo(
    () => (transaction ? toStructuredCommunication(transaction.id) : null),
    [transaction]
  );

  useEffect(() => {
    if (!transaction || !structuredCommunication) {
      setQrImageSrc(null);
      return;
    }

    const ibanName = import.meta.env.VITE_IBAN_NAME ?? "KO-LAB";
    const ibanNumber = import.meta.env.VITE_IBAN ?? "BE00000000000000";
    const payMessage = structuredCommunication;
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
      width: QR_SIZE,
      height: QR_SIZE,
      color: "#000000",
      background: "#ffffff",
      ecl: "H"
    });

    const qrSvg = qr.svg();
    setQrImageSrc(
      `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg)}`
    );
  }, [structuredCommunication, transaction]);

  const handleQuantityChange = (
    productId: string,
    delta: number,
    isMemberPrice: boolean
  ) => {
    setCart((current) =>
      updateCartQuantity(current, productId, delta, isMemberPrice)
    );
  };

  const openCheckoutConfirm = () => {
    if (!hasCheckoutItems || isBusy) {
      return;
    }
    setShowCheckoutConfirm(true);
  };

  const startCheckout = async () => {
    setStatus(null);
    setLoading(true);

    try {
      const response = await client.transaction.start({
        items: toTransactionItems(cart)
      });
      setShowCheckoutConfirm(false);
      setTransaction(response);
      setView("checkout");
      scrollToTop();
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
      if (status === "completed") {
        scrollToTop();
      }
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
      if (
        adminProductFilter !== "all" &&
        !transaction.items.some((item) => item.productId === adminProductFilter)
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
  }, [
    adminTransactions,
    adminStatusFilter,
    adminProductFilter,
    adminFromDate,
    adminToDate
  ]);

  const adminProductOptions = useMemo(() => {
    const lookup = new Map<string, string>();
    for (const transaction of adminTransactions ?? []) {
      for (const item of transaction.items) {
        if (!lookup.has(item.productId)) {
          lookup.set(item.productId, item.name);
        }
      }
    }
    return [...lookup.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, name]) => ({ id, name }));
  }, [adminTransactions]);

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
  const hasCheckoutItems = cart.some((item) => item.quantity > 0);
  const isSafeToRefresh =
    uiMode === "pos" && view === "cart" && !hasCheckoutItems && !isBusy && !transaction;

  useEffect(() => {
    let isMounted = true;

    const checkVersion = async () => {
      try {
        const response = await fetch(`/version.json?t=${Date.now()}`, {
          cache: "no-store"
        });
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as VersionPayload;
        const remoteVersion = payload.version?.trim();
        if (!remoteVersion || remoteVersion === APP_VERSION) {
          return;
        }

        if (!isMounted) {
          return;
        }

        if (isSafeToRefresh) {
          window.location.reload();
          return;
        }

        setUpdateReady(true);
      } catch {
        // Ignore failed version checks (offline, transient errors).
      }
    };

    void checkVersion();
    const intervalId = window.setInterval(() => {
      void checkVersion();
    }, VERSION_CHECK_INTERVAL_MS);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [isSafeToRefresh]);

  useEffect(() => {
    if (updateReady && isSafeToRefresh) {
      window.location.reload();
    }
  }, [updateReady, isSafeToRefresh]);

  const getQuantity = (productId: string, isMemberPrice: boolean) =>
    cart.find(
      (item) =>
        item.productId === productId && item.isMemberPrice === isMemberPrice
    )?.quantity ?? 0;

  const loadStockSnapshot = async (password: string) => {
    const response = await client.admin.getStock({ password });
    setStockSnapshot(response);
    setStockDraftByProductId(
      Object.fromEntries(
        response.items.map((item) => [item.productId, String(item.quantity)])
      )
    );
  };

  const loadAdminTransactions = async () => {
    setAdminError(null);
    setAdminLoading(true);
    try {
      const password = adminPassword;
      const response = await client.admin.exportTransactions({ password });
      setAdminTransactions(response.transactions);
      await loadStockSnapshot(password);
      setAdminSessionPassword(password);
      setAdminPassword("");
      setAdminStatusFilter("all");
      setAdminProductFilter("all");
      setAdminFromDate("");
      setAdminToDate("");
    } catch {
      setAdminError("Invalid password or admin panel unavailable.");
    } finally {
      setAdminLoading(false);
    }
  };

  const updateStock = async (productId: string) => {
    if (!adminSessionPassword) {
      setAdminError("Admin session expired. Please unlock again.");
      return;
    }

    const quantity = Number.parseInt(stockDraftByProductId[productId] ?? "", 10);
    if (!Number.isFinite(quantity) || quantity < 0) {
      setAdminError("Stock must be a non-negative integer.");
      return;
    }

    setAdminError(null);
    setAdminLoading(true);
    try {
      const response = await client.admin.setStock({
        password: adminSessionPassword,
        productId,
        quantity,
        note: stockNoteByProductId[productId]?.trim() || undefined
      });
      setStockSnapshot(response);
      setStockDraftByProductId(
        Object.fromEntries(
          response.items.map((item) => [item.productId, String(item.quantity)])
        )
      );
      setStockNoteByProductId((current) => ({ ...current, [productId]: "" }));
    } catch {
      setAdminError("Could not update stock.");
    } finally {
      setAdminLoading(false);
    }
  };

  const lockAdminPanel = () => {
    setAdminTransactions(null);
    setStockSnapshot(null);
    setStockDraftByProductId({});
    setStockNoteByProductId({});
    setAdminSessionPassword("");
    setAdminPassword("");
    setAdminError(null);
    setAdminStatusFilter("all");
    setAdminProductFilter("all");
    setAdminFromDate("");
    setAdminToDate("");
    setAdminTab("transactions");
  };

  const downloadAdminCsv = () => {
    const csv = buildTransactionsCsv(adminFilteredTransactions);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    link.href = url;
    link.download = `transactions-${timestamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen px-3 py-8 sm:px-6">
      <div className="mx-auto flex max-w-4xl flex-col gap-8">
        <header className="sticky top-0 z-30 rounded-2xl border border-black/10 bg-white/80 p-3 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-900/80">
          <div className="flex items-center gap-3 overflow-x-auto whitespace-nowrap">
            <h1 className="text-base font-semibold">Fridge Checkout</h1>
            <button
              type="button"
              onClick={() => {
                setUiMode((current) => (current === "pos" ? "admin" : "pos"));
                setAdminError(null);
              }}
              className={`rounded-full border border-slate-300 px-4 py-2 text-sm transition hover:border-slate-500 dark:border-slate-600 dark:hover:border-slate-300 ${
                uiMode === "pos" ? "hidden sm:inline-flex" : "inline-flex"
              }`}
            >
              {uiMode === "pos" ? "Admin panel" : "Back to checkout"}
            </button>
            <button
              type="button"
              onClick={() => setIsDark((value) => !value)}
              className="rounded-full border border-slate-300 px-3 py-2 text-sm transition hover:border-slate-500 dark:border-slate-600 dark:hover:border-slate-300"
              aria-label="Toggle theme"
              title={isDark ? "Switch to light theme" : "Switch to dark theme"}
            >
              {isDark ? "☀️" : "🌙"}
            </button>
            {uiMode === "admin" && adminTransactions && (
              <button
                type="button"
                onClick={lockAdminPanel}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm transition hover:border-slate-500 dark:border-slate-600 dark:text-slate-300"
              >
Logout
              </button>
            )}
            {uiMode === "pos" && view === "cart" && (
              <div className="ml-auto flex items-center gap-3">
                <button
                  type="button"
                  onClick={openCheckoutConfirm}
                  disabled={!hasCheckoutItems || isBusy}
                  className="rounded-full bg-accent-light px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-accent-dark dark:text-slate-900"
                >
                  Checkout ({totalLabel})
                </button>
              </div>
            )}
          </div>
        </header>

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
        {updateReady && (
          <div className="rounded-lg bg-amber-100 px-4 py-2 text-sm text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">
            Update available. Page will refresh automatically when no items are selected.
          </div>
        )}

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
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAdminTab("transactions")}
                    className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                      adminTab === "transactions"
                        ? "bg-accent-light text-white dark:bg-accent-dark dark:text-slate-900"
                        : "border border-slate-300 hover:border-slate-500 dark:border-slate-600"
                    }`}
                  >
                    Transactions
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminTab("stock")}
                    className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                      adminTab === "stock"
                        ? "bg-accent-light text-white dark:bg-accent-dark dark:text-slate-900"
                        : "border border-slate-300 hover:border-slate-500 dark:border-slate-600"
                    }`}
                  >
                    Stock
                  </button>
                </div>
                {adminTab === "transactions" && (
                <>
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

                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={lockAdminPanel}
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold transition hover:border-slate-500 dark:border-slate-600"
                  >
                    Refresh
                  </button>
                  <button
                    type="button"
                    onClick={downloadAdminCsv}
                    disabled={adminFilteredTransactions.length === 0}
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600"
                  >
                    Download CSV (filtered)
                  </button>
                </div>

                <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
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
                      Product
                    </span>
                    <select
                      value={adminProductFilter}
                      onChange={(event) => setAdminProductFilter(event.target.value)}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-700 outline-none transition focus:border-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                    >
                      <option value="all">All</option>
                      {adminProductOptions.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name}
                        </option>
                      ))}
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
                        const today = new Date();
                        const to = today.toISOString().slice(0, 10);
                        const from = new Date(Date.now() - 24 * 60 * 60 * 1000);
                        setAdminFromDate(from.toISOString().slice(0, 10));
                        setAdminToDate(to);
                      }}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm transition hover:border-slate-500 dark:border-slate-600"
                    >
                      Last 24h
                    </button>
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => {
                        setAdminStatusFilter("all");
                        setAdminProductFilter("all");
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
                </>
                )}

                {adminTab === "stock" && stockSnapshot && (
                  <div className="flex flex-col gap-4">
                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                      <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
                        <thead className="bg-slate-50 dark:bg-slate-800/40">
                          <tr>
                            <th className="px-3 py-2 text-left font-semibold">Product</th>
                            <th className="px-3 py-2 text-right font-semibold">Current</th>
                            <th className="px-3 py-2 text-right font-semibold">New stock</th>
                            <th className="px-3 py-2 text-left font-semibold">Note</th>
                            <th className="px-3 py-2 text-right font-semibold">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                          {stockSnapshot.items.map((item) => (
                            <tr key={item.productId}>
                              <td className="px-3 py-2">{item.productName}</td>
                              <td className="px-3 py-2 text-right font-semibold">{item.quantity}</td>
                              <td className="px-3 py-2 text-right">
                                <input
                                  type="number"
                                  min={0}
                                  value={stockDraftByProductId[item.productId] ?? "0"}
                                  onChange={(event) =>
                                    setStockDraftByProductId((current) => ({
                                      ...current,
                                      [item.productId]: event.target.value
                                    }))
                                  }
                                  className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-right dark:border-slate-600 dark:bg-slate-900"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="text"
                                  value={stockNoteByProductId[item.productId] ?? ""}
                                  placeholder="Manual count"
                                  onChange={(event) =>
                                    setStockNoteByProductId((current) => ({
                                      ...current,
                                      [item.productId]: event.target.value
                                    }))
                                  }
                                  className="w-full rounded-lg border border-slate-300 px-2 py-1 dark:border-slate-600 dark:bg-slate-900"
                                />
                              </td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => void updateStock(item.productId)}
                                  className="rounded-lg bg-accent-light px-3 py-1 text-xs font-semibold text-white dark:bg-accent-dark dark:text-slate-900"
                                >
                                  Save
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                      <h3 className="text-sm font-semibold">Recent stock events</h3>
                      <ul className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                        {stockSnapshot.events.slice(0, 12).map((event) => (
                          <li key={event.id}>
                            {new Date(event.createdAt).toLocaleString()} — {event.productId} — {event.type} {event.quantity}
                            {event.note ? ` (${event.note})` : ""}
                          </li>
                        ))}
                        {stockSnapshot.events.length === 0 && <li>No stock events yet.</li>}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        ) : view === "cart" ? (
          <section>
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
                {filteredProducts.length === 0 && (
                  <p className="text-sm text-slate-500">
                    {products.length === 0
                      ? "No products configured."
                      : "No products match search."}
                  </p>
                )}
                {filteredProducts.map((product) => {
                  const unitPrice = getUnitPrice(
                    product,
                    priceCategories,
                    defaultIsMemberPrice
                  );
                  const quantity = getQuantity(product.id, defaultIsMemberPrice);

                  return (
                    <div
                      key={product.id}
                      className="flex items-center justify-between gap-3 border-b border-black/5 pb-3 last:border-b-0 dark:border-white/10"
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <p className="font-medium break-words">
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
                      <div className="shrink-0 flex items-center gap-1.5 self-center">
                        <button
                          type="button"
                          onClick={() =>
                            handleQuantityChange(product.id, -1, defaultIsMemberPrice)
                          }
                          className="h-10 w-10 rounded-xl border border-slate-300 text-xl leading-none transition hover:border-slate-500 dark:border-slate-600"
                        >
                          -
                        </button>
                        <span className="w-5 text-center text-sm font-semibold">{quantity}</span>
                        <button
                          type="button"
                          onClick={() =>
                            handleQuantityChange(product.id, 1, defaultIsMemberPrice)
                          }
                          className="h-10 w-10 rounded-xl border border-slate-300 text-xl leading-none transition hover:border-slate-500 dark:border-slate-600"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        ) : (
          <section className="flex flex-col gap-6">
            <div className="rounded-2xl border border-black/10 bg-white/80 p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
              <h2 className="text-lg font-semibold">Pay at the fridge</h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
                Scan the QR code and pay the total. When done, press "I paid".
              </p>
              <div className="mt-6 rounded-2xl border border-dashed border-slate-400/60 p-6 text-center dark:border-slate-500">
                {qrImageSrc ? (
                  <img
                    className="mx-auto block h-56 w-56 rounded bg-white"
                    src={qrImageSrc}
                    alt="Payment QR"
                  />
                ) : (
                  <div className="mx-auto h-56 w-56 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-700" />
                )}
                <div className="mt-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                    Amount due
                  </p>
                  <p className="text-2xl font-semibold">{totalLabel}</p>
                </div>
                {structuredCommunication && (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left dark:border-slate-700 dark:bg-slate-900/40">
                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Gestructureerde mededeling
                    </p>
                    <p className="mt-1 font-mono text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {structuredCommunication}
                    </p>
                  </div>
                )}
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

        {uiMode === "pos" && view === "cart" && showCheckoutConfirm && (
          <div
            className="fixed inset-0 z-40 flex items-start justify-center bg-black/50 p-4 pt-6"
            onClick={() => setShowCheckoutConfirm(false)}
          >
            <div
              className="w-full max-w-2xl rounded-2xl border border-black/10 bg-white p-6 shadow-xl dark:border-white/10 dark:bg-slate-900"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">Confirm checkout</h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
                    Review and edit your cart before generating the payment QR.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void startCheckout()}
                  disabled={!hasCheckoutItems || isBusy}
                  className="rounded-xl bg-accent-light px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-accent-dark dark:text-slate-900"
                >
                  Confirm ({totalLabel})
                </button>
              </div>

              <div className="mt-4 max-h-[50vh] overflow-y-auto rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                {cartItemsForCheckout.length === 0 ? (
                  <p className="text-sm text-slate-500">Your cart is empty.</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {cartItemsForCheckout.map((item) => (
                      <div
                        key={`${item.productId}-${item.isMemberPrice}`}
                        className="flex items-center justify-between gap-3 border-b border-black/5 pb-3 last:border-b-0 dark:border-white/10"
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <p className="font-medium break-words">
                            {item.name}{" "}
                            <span className="text-xs uppercase text-slate-500">
                              {formatPriceMode(item.isMemberPrice)}
                            </span>
                          </p>
                          <p className="text-sm text-slate-500 dark:text-slate-300">
                            {currencyFormatter.format(item.unitPrice)}
                          </p>
                        </div>
                        <div className="shrink-0 flex items-center gap-1.5 self-center">
                          <button
                            type="button"
                            onClick={() =>
                              handleQuantityChange(item.productId, -1, item.isMemberPrice)
                            }
                            className="h-10 w-10 rounded-xl border border-slate-300 text-xl leading-none transition hover:border-slate-500 dark:border-slate-600"
                          >
                            -
                          </button>
                          <span className="w-5 text-center text-sm font-semibold">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              handleQuantityChange(item.productId, 1, item.isMemberPrice)
                            }
                            className="h-10 w-10 rounded-xl border border-slate-300 text-xl leading-none transition hover:border-slate-500 dark:border-slate-600"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-slate-600 dark:text-slate-300">Total</p>
                <p className="text-xl font-semibold">{totalLabel}</p>
              </div>

              <div className="mt-6 flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCheckoutConfirm(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-500 dark:border-slate-600 dark:text-slate-200"
                >
                  Back
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
