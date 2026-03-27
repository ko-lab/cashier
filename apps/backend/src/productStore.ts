import path from "node:path";
import { readJson } from "./storage.ts";
import type { ProductCatalog } from "../../../shared/models.ts";

export type ProductStore = {
  listCatalog: () => Promise<ProductCatalog>;
};

function sanitizeCatalog(catalog: ProductCatalog): ProductCatalog {
  const nextProducts: ProductCatalog["products"] = {};

  for (const [id, product] of Object.entries(catalog.products ?? {})) {
    const inventoryCount =
      Number.isFinite(product.inventoryCount) && product.inventoryCount >= 0
        ? Math.trunc(product.inventoryCount)
        : 0;

    if (inventoryCount !== product.inventoryCount) {
      console.warn(
        `[catalog-sanitize] adjusted inventoryCount for ${id}: ${product.inventoryCount} -> ${inventoryCount}`
      );
    }

    nextProducts[id] = {
      ...product,
      inventoryCount
    };
  }

  return {
    products: nextProducts,
    priceCategories: catalog.priceCategories ?? {}
  };
}

export function createProductStore(dataDir: string): ProductStore {
  const productsPath = path.join(dataDir, "products.json");

  return {
    async listCatalog() {
      const catalog = await readJson<ProductCatalog>(productsPath, {
        products: {},
        priceCategories: {}
      });

      return sanitizeCatalog(catalog);
    }
  };
}
