import type { PriceCategory, Product } from "@shared/models";
import { getUnitPrice } from "./pricing";

export type CartItem = {
  productId: string;
  quantity: number;
  isMemberPrice: boolean;
};

export type CartLine = {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  isMemberPrice: boolean;
};

export type CartSummary = {
  items: CartLine[];
  total: number;
};

export function updateCartQuantity(
  cart: CartItem[],
  productId: string,
  delta: number,
  isMemberPrice: boolean
): CartItem[] {
  const index = cart.findIndex(
    (item) =>
      item.productId === productId && item.isMemberPrice === isMemberPrice
  );

  if (index >= 0) {
    const next = [...cart];
    const current = next[index];
    const nextQuantity = Math.max(0, current.quantity + delta);
    next[index] = { ...current, quantity: nextQuantity };
    return next;
  }

  if (delta <= 0) {
    return cart;
  }

  return [...cart, { productId, quantity: delta, isMemberPrice }];
}

export function buildCartSummary(
  products: Product[],
  priceCategories: PriceCategory[],
  cart: CartItem[],
): CartSummary {
  const productMap = new Map(products.map((product) => [product.id, product]));
  const items = cart
    .map((item) => {
      const product = productMap.get(item.productId);
      if (!product || !product.active) {
        return null;
      }
      const unitPrice = getUnitPrice(product, priceCategories, item.isMemberPrice);
      const lineTotal = Number((unitPrice * item.quantity).toFixed(2));

      return {
        productId: product.id,
        name: product.name,
        quantity: item.quantity,
        unitPrice,
        lineTotal,
        isMemberPrice: item.isMemberPrice
      };
    })
    .filter((item): item is CartLine => item !== null);

  const total = Number(items.reduce((sum, item) => sum + item.lineTotal, 0).toFixed(2));

  return { items, total };
}

export function toTransactionItems(cart: CartItem[]): CartItem[] {
  return cart.filter((item) => item.quantity > 0);
}

export function sortProducts(products: Product[]): Product[] {
  return [...products].sort((a, b) => {
    const aInStock = a.inventoryCount > 0 ? 1 : 0;
    const bInStock = b.inventoryCount > 0 ? 1 : 0;
    if (aInStock !== bInStock) {
      return bInStock - aInStock;
    }
    return a.name.localeCompare(b.name);
  });
}
