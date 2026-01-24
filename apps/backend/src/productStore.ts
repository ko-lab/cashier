import path from "node:path";
import { readJson } from "./storage.ts";
import type { ProductCatalog } from "../../../shared/models.ts";

export type ProductStore = {
  listCatalog: () => Promise<ProductCatalog>;
};

export function createProductStore(dataDir: string): ProductStore {
  const productsPath = path.join(dataDir, "products.json");

  return {
    async listCatalog() {
      return readJson<ProductCatalog>(productsPath, {
        products: [],
        priceCategories: []
      });
    }
  };
}
