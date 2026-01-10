import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode-svg";
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
  const [cart, setCart] = useState<
    { productId: string; quantity: number; isMemberPrice: boolean }[]
  >([]);
  const [priceModeByProductId, setPriceModeByProductId] = useState<
    Record<string, boolean>
  >({});
  const [searchQuery, setSearchQuery] = useState("");
  const [view, setView] = useState<View>("cart");
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
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

  const summary = useMemo(() => buildCartSummary(products, cart), [products, cart]);

  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return products;
    }
    return products.filter((product) =>
      product.name.toLowerCase().includes(query)
    );
  }, [products, searchQuery]);

  const selectedProducts = useMemo(() => {
    return filteredProducts.filter((product) =>
      cart.some((item) => item.productId === product.id)
    );
  }, [filteredProducts, cart]);

  const unselectedFilteredProducts = useMemo(() => {
    const selectedIds = new Set(selectedProducts.map((product) => product.id));
    return filteredProducts.filter((product) => !selectedIds.has(product.id));
  }, [filteredProducts, selectedProducts]);

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
  const formatPriceMode = (isMember: boolean) =>
    isMember ? "(member price)" : "(regular price)";
  const getQuantity = (productId: string, isMemberPrice: boolean) =>
    cart.find(
      (item) =>
        item.productId === productId && item.isMemberPrice === isMemberPrice
    )?.quantity ?? 0;

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
                {selectedProducts.length > 0 && (
                  <div className="rounded-xl border border-dashed border-slate-400/60 px-4 py-3 dark:border-slate-500">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-300">
                      Selected
                    </p>
                    <div className="mt-3 flex flex-col gap-4">
                      {selectedProducts.map((product) => {
                        const isMemberPrice =
                          priceModeByProductId[product.id] ?? false;
                        const unitPrice = isMemberPrice
                          ? product.priceMember
                          : product.priceNonMember;
                        const quantity = getQuantity(product.id, isMemberPrice);

                        return (
                          <div
                            key={product.id}
                            className="flex flex-wrap items-center justify-between gap-3 border-b border-black/5 pb-3 last:border-b-0 dark:border-white/10"
                          >
                            <div>
                              <p className="font-medium">
                                {product.name}{" "}
                                <span className="text-xs uppercase text-slate-500">
                                  {formatPriceMode(isMemberPrice)}
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
                                  setPriceModeByProductId((current) => ({
                                    ...current,
                                    [product.id]: !isMemberPrice
                                  }))
                                }
                                className="rounded-full border border-slate-300 px-3 py-1 text-xs uppercase tracking-wide text-slate-600 transition hover:border-slate-500 dark:border-slate-600 dark:text-slate-200"
                              >
                                {isMemberPrice ? "Member" : "Regular"}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleQuantityChange(
                                    product.id,
                                    -1,
                                    isMemberPrice
                                  )
                                }
                                className="h-8 w-8 rounded-full border border-slate-300 text-lg transition hover:border-slate-500 dark:border-slate-600"
                              >
                                -
                              </button>
                              <span className="w-6 text-center text-sm font-semibold">
                                {quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  handleQuantityChange(
                                    product.id,
                                    1,
                                    isMemberPrice
                                  )
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
                )}
                {unselectedFilteredProducts.length === 0 && selectedProducts.length === 0 && (
                  <p className="text-sm text-slate-500">
                    {products.length === 0 ? "No products configured." : "No products match search."}
                  </p>
                )}
                {unselectedFilteredProducts.map((product) => {
                  if (!product.active) {
                    return null;
                  }
                  const isMemberPrice =
                    priceModeByProductId[product.id] ?? false;
                  const unitPrice = isMemberPrice
                    ? product.priceMember
                    : product.priceNonMember;
                  const quantity = getQuantity(product.id, isMemberPrice);

                  return (
                    <div
                      key={product.id}
                      className="flex flex-wrap items-center justify-between gap-3 border-b border-black/5 pb-3 last:border-b-0 dark:border-white/10"
                    >
                      <div>
                        <p className="font-medium">
                          {product.name}{" "}
                          <span className="text-xs uppercase text-slate-500">
                            {formatPriceMode(isMemberPrice)}
                          </span>
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-300">
                          {currencyFormatter.format(unitPrice)} - stock {product.inventoryCount}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            setPriceModeByProductId((current) => ({
                              ...current,
                              [product.id]: !isMemberPrice
                            }))
                          }
                          className="rounded-full border border-slate-300 px-3 py-1 text-xs uppercase tracking-wide text-slate-600 transition hover:border-slate-500 dark:border-slate-600 dark:text-slate-200"
                        >
                          {isMemberPrice ? "Member" : "Regular"}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleQuantityChange(product.id, -1, isMemberPrice)
                          }
                          className="h-8 w-8 rounded-full border border-slate-300 text-lg transition hover:border-slate-500 dark:border-slate-600"
                        >
                          -
                        </button>
                        <span className="w-6 text-center text-sm font-semibold">{quantity}</span>
                        <button
                          type="button"
                          onClick={() =>
                            handleQuantityChange(product.id, 1, isMemberPrice)
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
