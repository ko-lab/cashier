import type { Product } from "@shared/models";
import type { CartItem } from "./cart";

export type SelectedItemView = {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  inventoryCount: number;
  isMemberPrice: boolean;
};

export function formatPriceMode(isMemberPrice: boolean): string {
  return isMemberPrice ? "(member price)" : "(regular price)";
}

export function filterProductsByQuery(
  products: Product[],
  searchQuery: string
): Product[] {
  const query = searchQuery.trim().toLowerCase();
  if (!query) {
    return products;
  }
  return products.filter((product) =>
    product.name.toLowerCase().includes(query)
  );
}

export function getSelectedItems(
  products: Product[],
  cart: CartItem[],
  searchQuery: string
): SelectedItemView[] {
  const filteredProducts = filterProductsByQuery(products, searchQuery);
  const filteredMap = new Map(
    filteredProducts.map((product) => [product.id, product])
  );

  return cart
    .filter((item) => filteredMap.has(item.productId))
    .map((item) => {
      const product = filteredMap.get(item.productId)!;
      const unitPrice = item.isMemberPrice
        ? product.priceMember
        : product.priceNonMember;

      return {
        productId: item.productId,
        name: product.name,
        quantity: item.quantity,
        unitPrice,
        inventoryCount: product.inventoryCount,
        isMemberPrice: item.isMemberPrice
      };
    });
}

export function getUnselectedProducts(
  products: Product[],
  cart: CartItem[],
  searchQuery: string,
  isMemberPrice: boolean
): Product[] {
  const filteredProducts = filterProductsByQuery(products, searchQuery).filter(
    (product) => product.active
  );
  const selectedIdsForMode = new Set(
    cart
      .filter((item) => item.isMemberPrice === isMemberPrice)
      .map((item) => item.productId)
  );

  return filteredProducts.filter(
    (product) => !selectedIdsForMode.has(product.id)
  );
}
