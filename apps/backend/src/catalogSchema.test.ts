import { describe, expect, it } from "vitest";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { ProductCatalogFileSchema } from "./catalogSchema.ts";

describe("catalog/products.json", () => {
  it("matches the zod v4 schema and internal references", async () => {
    const productsPath = path.resolve(
      import.meta.dirname,
      "../catalog/products.json"
    );

    const fileContent = await readFile(productsPath, "utf8");
    const parsedJson = JSON.parse(fileContent) as unknown;
    const catalog = ProductCatalogFileSchema.parse(parsedJson);

    for (const [productKey, product] of Object.entries(catalog.products)) {
      expect(product.id).toBe(productKey);
      expect(catalog.priceCategories[product.priceCategoryId]).toBeDefined();
    }

    for (const [categoryKey, category] of Object.entries(catalog.priceCategories)) {
      expect(category.id).toBe(categoryKey);
    }
  });
});
