import type { PriceCategory, Product } from "@shared/models";
import { getUnitPrice } from "../../domain/pricing";
import { formatPriceMode } from "../../domain/productSection";

type ProductsPanelProps = {
  products: Product[];
  filteredProducts: Product[];
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  defaultIsMemberPrice: boolean;
  setDefaultIsMemberPrice: (value: boolean) => void;
  priceCategories: PriceCategory[];
  currencyFormatter: { format(value: number): string };
  getQuantity: (productId: string, isMemberPrice: boolean) => number;
  handleQuantityChange: (productId: string, delta: number, isMemberPrice: boolean) => void;
};

export function ProductsPanel({
  products,
  filteredProducts,
  searchQuery,
  setSearchQuery,
  defaultIsMemberPrice,
  setDefaultIsMemberPrice,
  priceCategories,
  currencyFormatter,
  getQuantity,
  handleQuantityChange
}: ProductsPanelProps): JSX.Element {
  return (
    <div className="rounded-2xl border border-black/10 bg-white/80 p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">Products</h2>
        <div className="flex items-center gap-3 rounded-full border border-slate-200 px-3 py-1 text-xs uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:text-slate-200">
          <span>{defaultIsMemberPrice ? "Member price" : "Non-member price"}</span>
          <button
            type="button"
            onClick={() => setDefaultIsMemberPrice(!defaultIsMemberPrice)}
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
            {products.length === 0 ? "No products configured." : "No products match search."}
          </p>
        )}
        {filteredProducts.map((product) => {
          const unitPrice = getUnitPrice(product, priceCategories, defaultIsMemberPrice);
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
                  {currencyFormatter.format(unitPrice)} - stock {product.inventoryCount}
                </p>
              </div>
              <div className="shrink-0 flex items-center gap-1.5 self-center">
                <button
                  type="button"
                  onClick={() => handleQuantityChange(product.id, -1, defaultIsMemberPrice)}
                  className="h-10 w-10 rounded-xl border border-slate-300 text-xl leading-none transition hover:border-slate-500 dark:border-slate-600"
                >
                  -
                </button>
                <span className="w-5 text-center text-sm font-semibold">{quantity}</span>
                <button
                  type="button"
                  onClick={() => handleQuantityChange(product.id, 1, defaultIsMemberPrice)}
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
  );
}
