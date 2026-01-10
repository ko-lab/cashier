import { describe, expect, it } from "vitest";
import type { Product } from "@shared/models";
import { buildCartSummary, updateCartQuantity } from "./cart";

const products: Product[] = [
  {
    id: "cola",
    name: "Cola",
    priceMember: 1,
    priceNonMember: 1.5,
    inventoryCount: 10,
    active: true
  },
  {
    id: "chips",
    name: "Chips",
    priceMember: 2,
    priceNonMember: 2.5,
    inventoryCount: 5,
    active: true
  }
];

describe("cart domain", () => {
  it("updates quantities and removes zero", () => {
    const cart = updateCartQuantity([], "cola", 1);
    expect(cart).toEqual([{ productId: "cola", quantity: 1 }]);

    const updated = updateCartQuantity(cart, "cola", -1);
    expect(updated).toEqual([]);
  });

  it("calculates member totals", () => {
    const summary = buildCartSummary(
      products,
      [
        { productId: "cola", quantity: 2 },
        { productId: "chips", quantity: 1 }
      ],
      true
    );

    expect(summary.total).toBe(4);
    expect(summary.items).toHaveLength(2);
  });

  it("calculates non-member totals", () => {
    const summary = buildCartSummary(products, [{ productId: "cola", quantity: 3 }], false);
    expect(summary.total).toBe(4.5);
  });
});
