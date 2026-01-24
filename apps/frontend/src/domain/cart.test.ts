import { describe, expect, it } from "vitest";
import type { PriceCategory, Product } from "@shared/models";
import { buildCartSummary, updateCartQuantity } from "./cart";

const priceCategories: PriceCategory[] = [
  {
    id: "snack",
    name: "Snack",
    priceMember: 1,
    priceNonMember: 1.5
  },
  {
    id: "crisps",
    name: "Crisps",
    priceMember: 2,
    priceNonMember: 2.5
  }
];

const products: Product[] = [
  {
    id: "cola",
    name: "Cola",
    priceCategoryId: "snack",
    inventoryCount: 10,
    active: true
  },
  {
    id: "chips",
    name: "Chips",
    priceCategoryId: "crisps",
    inventoryCount: 5,
    active: true
  }
];

describe("cart domain", () => {
  it("updates quantities and removes zero", () => {
    const cart = updateCartQuantity([], "cola", 1, true);
    expect(cart).toEqual([
      { productId: "cola", quantity: 1, isMemberPrice: true }
    ]);

    const updated = updateCartQuantity(cart, "cola", -1, true);
    expect(updated).toEqual([]);
  });

  it("calculates member totals", () => {
    const summary = buildCartSummary(
      products,
      priceCategories,
      [
        { productId: "cola", quantity: 2, isMemberPrice: true },
        { productId: "chips", quantity: 1, isMemberPrice: true }
      ]
    );

    expect(summary.total).toBe(4);
    expect(summary.items).toHaveLength(2);
  });

  it("calculates non-member totals", () => {
    const summary = buildCartSummary(products, priceCategories, [
      { productId: "cola", quantity: 3, isMemberPrice: false }
    ]);
    expect(summary.total).toBe(4.5);
  });
});
