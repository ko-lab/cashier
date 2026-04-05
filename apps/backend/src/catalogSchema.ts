import * as z from "zod/v4";

export const ProductFileSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    priceCategoryId: z.string().min(1),
    active: z.boolean().optional(),
    inventoryCount: z.number().int().nonnegative().optional()
  })
  .strict();

export const PriceCategoryFileSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    priceMember: z.number().nonnegative(),
    priceNonMember: z.number().nonnegative()
  })
  .strict();

export const ProductCatalogFileSchema = z
  .object({
    products: z.record(z.string(), ProductFileSchema),
    priceCategories: z.record(z.string(), PriceCategoryFileSchema)
  })
  .strict();

export type ProductCatalogFile = z.infer<typeof ProductCatalogFileSchema>;
