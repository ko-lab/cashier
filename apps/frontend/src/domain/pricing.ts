import type { PriceCategory, Product } from "@shared/models";

export function getPriceCategoryMap(
  priceCategories: PriceCategory[]
): Map<string, PriceCategory> {
  return new Map(priceCategories.map((category) => [category.id, category]));
}

export function getUnitPrice(
  product: Product,
  priceCategories: PriceCategory[],
  isMemberPrice: boolean
): number {
  const category = priceCategories.find(
    (entry) => entry.id === product.priceCategoryId
  );
  if (!category) {
    return 0;
  }
  return isMemberPrice ? category.priceMember : category.priceNonMember;
}
