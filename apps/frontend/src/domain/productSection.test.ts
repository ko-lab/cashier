import { describe, expect, it } from "vitest";
import type { Product } from "@shared/models";
import { updateCartQuantity } from "./cart";
import {
  formatPriceMode,
  getSelectedItems,
  getUnselectedProducts
} from "./productSection";

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

describe("product section view", () => {
  it("shows quantity for regular items in selected section", () => {
    const cartOnce = updateCartQuantity([], "cola", 1, false);
    const cartTwice = updateCartQuantity(cartOnce, "cola", 1, false);

    const selected = getSelectedItems(products, cartTwice, "");

    expect(selected).toHaveLength(1);
    expect(selected[0].quantity).toBe(2);
    expect(selected[0].isMemberPrice).toBe(false);
  });

  it("lets member-priced items be added after regular selection", () => {
    const cartRegular = updateCartQuantity([], "cola", 1, false);

    const availableForMember = getUnselectedProducts(
      products,
      cartRegular,
      "",
      true
    );
    expect(availableForMember.map((product) => product.id)).toContain("cola");

    const cartWithMember = updateCartQuantity(cartRegular, "cola", 1, true);
    const selected = getSelectedItems(products, cartWithMember, "");
    expect(selected).toHaveLength(2);

    const memberEntry = selected.find((item) => item.isMemberPrice);
    expect(memberEntry).toBeDefined();
    expect(formatPriceMode(memberEntry!.isMemberPrice)).toBe("(member price)");
  });
});
