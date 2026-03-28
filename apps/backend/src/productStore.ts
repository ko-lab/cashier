import path from "node:path";
import { readJson } from "./storage.ts";
import type { ProductCatalog } from "../../../shared/models.ts";
import type { StockEventStore } from "./stockEventStore.ts";

export type ProductStore = {
  listCatalog: () => Promise<ProductCatalog>;
};

export function createProductStore(
  catalogDir: string,
  stockEventStore: StockEventStore
): ProductStore {
  const productsPath = path.join(catalogDir, "products.json");

  return {
    async listCatalog() {
      const catalog = await readJson<{
        products: Record<string, Omit<ProductCatalog["products"][string], "inventoryCount"> & { inventoryCount?: number }>;
        priceCategories: ProductCatalog["priceCategories"];
      }>(productsPath, {
        products: {},
        priceCategories: {}
      });

      const stockByProductId = await stockEventStore.getCurrentQuantities();
      const products: ProductCatalog["products"] = {};

      for (const [id, product] of Object.entries(catalog.products ?? {})) {
        const override = stockByProductId.get(id)?.quantity;
        const fallback =
          Number.isFinite(product.inventoryCount) && Number(product.inventoryCount) >= 0
            ? Math.trunc(Number(product.inventoryCount))
            : 0;

        products[id] = {
          ...product,
          inventoryCount: override ?? fallback
        };
      }

      return {
        products,
        priceCategories: catalog.priceCategories ?? {}
      };
    }
  };
}
