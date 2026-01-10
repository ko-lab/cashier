import path from "node:path";
import { readJson } from "./storage";
import type { Product } from "../../../shared/models";

export type ProductStore = {
  listProducts: () => Promise<Product[]>;
};

export function createProductStore(dataDir: string): ProductStore {
  const productsPath = path.join(dataDir, "products.json");

  return {
    async listProducts() {
      return readJson<Product[]>(productsPath, []);
    }
  };
}
