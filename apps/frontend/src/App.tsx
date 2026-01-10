import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { client } from "./api/client";
import type { Product, Transaction } from "@shared/models";
import {
  buildCartSummary,
  sortProducts,
  toTransactionItems,
  updateCartQuantity
} from "./domain/cart";

type View = "cart" | "checkout";

type StatusMessage = {
  tone: "error" | "info";
  text: string;
};

const currencyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "EUR"
});

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<{ productId: string; quantity: number }[]>([]);
  const [isMemberPrice, setIsMemberPrice] = useState(false);
  const [view, setView] = useState<View>("cart");
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [loading, setLoading] = useState(false);
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
          setProducts(sortProducts(data));
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
    () => buildCartSummary(products, cart, isMemberPrice),
    [products, cart, isMemberPrice]
  );

  useEffect(() => {
    if (!transaction) {
      setQrDataUrl(null);
      return;
    }

    const payload = `KO-LAB POS|${transaction.id}|${transaction.total.toFixed(2)}`;
    QRCode.toDataURL(payload, { margin: 1, width: 220 })
      .then((url) => setQrDataUrl(url))
      .catch(() => setQrDataUrl(null));
  }, [transaction]);

  const handleQuantityChange = (productId: string, delta: number) => {
    setCart((current) => updateCartQuantity(current, productId, delta));
  };

  const startCheckout = async () => {
    setStatus(null);
    setLoading(true);

    try {
      const response = await client.transaction.start({
        items: toTransactionItems(cart),
        isMemberPrice
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

  return (
    <div className="min-h-screen px-6 py-8">
      <div className="mx-auto flex max-w-4xl flex-col gap-8">
        <header className="flex flex-col gap-4 rounded-2xl border border-black/10 bg-white/70 p-6 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-slate-500 dark:text-slate-300">
                KO-LAB POS
              </p>
              <h1 className="text-2xl font-semibold">Fridge Checkout</h1>
            </div>
            <button
              type="button"
              onClick={() => setIsDark((value) => !value)}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm transition hover:border-slate-500 dark:border-slate-600 dark:hover:border-slate-300"
            >
              {isDark ? "Light mode" : "Dark mode"}
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">Member prices</span>
              <button
                type="button"
                onClick={() => setIsMemberPrice((value) => !value)}
                className={`relative h-7 w-14 rounded-full transition ${
                  isMemberPrice
                    ? "bg-accent-light dark:bg-accent-dark"
                    : "bg-slate-300 dark:bg-slate-700"
                }`}
                aria-pressed={isMemberPrice}
              >
                <span
                  className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${
                    isMemberPrice ? "left-8" : "left-1"
                  }`}
                />
              </button>
            </div>
            <div className="text-sm text-slate-500 dark:text-slate-300">
              {loading ? "Loading..." : "Ready"}
            </div>
          </div>
          {status && (
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
        </header>

        {view === "cart" ? (
          <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
            <div className="rounded-2xl border border-black/10 bg-white/80 p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
              <h2 className="text-lg font-semibold">Products</h2>
              <div className="mt-4 flex flex-col gap-4">
                {products.length === 0 && (
                  <p className="text-sm text-slate-500">No products configured.</p>
                )}
                {products.map((product) => {
                  if (!product.active) {
                    return null;
                  }
                  const unitPrice = isMemberPrice
                    ? product.priceMember
                    : product.priceNonMember;
                  const quantity = cart.find((item) => item.productId === product.id)?.quantity ?? 0;

                  return (
                    <div
                      key={product.id}
                      className="flex flex-wrap items-center justify-between gap-3 border-b border-black/5 pb-3 last:border-b-0 dark:border-white/10"
                    >
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-300">
                          {currencyFormatter.format(unitPrice)} - stock {product.inventoryCount}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => handleQuantityChange(product.id, -1)}
                          className="h-8 w-8 rounded-full border border-slate-300 text-lg transition hover:border-slate-500 dark:border-slate-600"
                        >
                          -
                        </button>
                        <span className="w-6 text-center text-sm font-semibold">{quantity}</span>
                        <button
                          type="button"
                          onClick={() => handleQuantityChange(product.id, 1)}
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
                  <div key={item.productId} className="flex items-center justify-between">
                    <span>
                      {item.name} x {item.quantity}
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
                disabled={summary.items.length === 0 || loading}
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
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="Payment QR" className="h-56 w-56" />
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
                  disabled={loading}
                  className="rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:brightness-95 disabled:opacity-50"
                >
                  I paid
                </button>
                <button
                  type="button"
                  onClick={() => finalize("canceled")}
                  disabled={loading}
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
                  <div key={item.productId} className="flex items-center justify-between">
                    <span>
                      {item.name} x {item.quantity}
                    </span>
                    <span>{currencyFormatter.format(item.lineTotal)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 border-t border-black/10 pt-4 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                {transaction?.isMemberPrice ? "Member pricing" : "Guest pricing"}
              </div>
            </aside>
          </section>
        )}
      </div>
    </div>
  );
}
