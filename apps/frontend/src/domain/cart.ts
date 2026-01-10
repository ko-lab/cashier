import type { Product } from "@shared/models";

export type CartItem = {
  productId: string;
  quantity: number;
};

export type CartLine = {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type CartSummary = {
  items: CartLine[];
  total: number;
};

export function updateCartQuantity(
  cart: CartItem[],
  productId: string,
  delta: number
): CartItem[] {
  const existing = cart.find((item) => item.productId === productId);
  const nextQuantity = (existing?.quantity ?? 0) + delta;
  const filtered = cart.filter((item) => item.productId !== productId);

  if (nextQuantity <= 0) {
    return filtered;
  }

  return [...filtered, { productId, quantity: nextQuantity }];
}

export function buildCartSummary(
  products: Product[],
  cart: CartItem[],
  isMemberPrice: boolean
): CartSummary {
  const productMap = new Map(products.map((product) => [product.id, product]));
  const items = cart
    .map((item) => {
      const product = productMap.get(item.productId);
      if (!product || !product.active) {
        return null;
      }
      const unitPrice = isMemberPrice ? product.priceMember : product.priceNonMember;
      const lineTotal = Number((unitPrice * item.quantity).toFixed(2));

      return {
        productId: product.id,
        name: product.name,
        quantity: item.quantity,
        unitPrice,
        lineTotal
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
  return [...products].sort((a, b) => a.name.localeCompare(b.name));
}
