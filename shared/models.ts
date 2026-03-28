import * as z from "zod/v4";

export const PriceCategorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  priceMember: z.number().nonnegative(),
  priceNonMember: z.number().nonnegative()
});

export const ProductSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  priceCategoryId: z.string().min(1),
  inventoryCount: z.number().int(),
  active: z.boolean()
});

export const StockEventTypeSchema = z.enum(["manual_set", "sale_delta", "comment", "counted_ok"]);

export const StockEventSchema = z.object({
  id: z.string().min(1),
  productId: z.string().min(1),
  type: StockEventTypeSchema,
  quantity: z.number().int(),
  createdAt: z.string().min(1),
  note: z.string().optional()
});

export const AdminSetStockInputSchema = z
  .object({
    password: z.string().min(1),
    productId: z.string().min(1),
    quantity: z.number().int().optional(),
    note: z
      .string()
      .max(200)
      .regex(/^[^,;]*$/, "Note cannot contain commas or semicolons")
      .optional(),
    action: z.enum(["set", "comment", "counted_ok"]).optional()
  })
  .refine(
    (input) =>
      input.action === "counted_ok" ||
      input.quantity !== undefined ||
      !!input.note?.trim(),
    {
      message: "Either quantity or note is required"
    }
  );

export const AdminStockItemSchema = z.object({
  productId: z.string().min(1),
  productName: z.string().min(1),
  quantity: z.number().int(),
  updatedAt: z.string().min(1).optional()
});

export const AdminGetStockOutputSchema = z.object({
  items: z.array(AdminStockItemSchema),
  events: z.array(StockEventSchema)
});

export const ProductCatalogSchema = z.object({
  products: z.record(z.string(), ProductSchema),
  priceCategories: z.record(z.string(), PriceCategorySchema)
});

export const CartItemInputSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1),
  isMemberPrice: z.boolean()
});

export const TransactionStatusSchema = z.enum(["pending", "completed", "canceled"]);

export const TransactionItemSchema = z.object({
  productId: z.string().min(1),
  name: z.string().min(1),
  quantity: z.number().int().min(1),
  unitPrice: z.number().nonnegative(),
  lineTotal: z.number().nonnegative(),
  isMemberPrice: z.boolean()
});

export const TransactionSchema = z.object({
  id: z.string().min(1),
  createdAt: z.string().min(1),
  status: TransactionStatusSchema,
  total: z.number().nonnegative(),
  items: z.array(TransactionItemSchema)
});

export const StartTransactionInputSchema = z.object({
  items: z.array(CartItemInputSchema).min(1)
});

export const FinalizeTransactionInputSchema = z.object({
  id: z.string().min(1),
  status: TransactionStatusSchema.exclude(["pending"])
});

export const AdminExportTransactionsInputSchema = z.object({
  password: z.string().min(1)
});

export const AdminExportTransactionsOutputSchema = z.object({
  transactions: z.array(TransactionSchema)
});

export type Product = z.infer<typeof ProductSchema>;
export type PriceCategory = z.infer<typeof PriceCategorySchema>;
export type ProductCatalog = z.infer<typeof ProductCatalogSchema>;
export type StockEventType = z.infer<typeof StockEventTypeSchema>;
export type StockEvent = z.infer<typeof StockEventSchema>;
export type CartItemInput = z.infer<typeof CartItemInputSchema>;
export type TransactionStatus = z.infer<typeof TransactionStatusSchema>;
export type TransactionItem = z.infer<typeof TransactionItemSchema>;
export type Transaction = z.infer<typeof TransactionSchema>;
export type StartTransactionInput = z.infer<typeof StartTransactionInputSchema>;
export type FinalizeTransactionInput = z.infer<typeof FinalizeTransactionInputSchema>;
export type AdminExportTransactionsInput = z.infer<
  typeof AdminExportTransactionsInputSchema
>;
export type AdminExportTransactionsOutput = z.infer<
  typeof AdminExportTransactionsOutputSchema
>;
export type AdminSetStockInput = z.infer<typeof AdminSetStockInputSchema>;
export type AdminStockItem = z.infer<typeof AdminStockItemSchema>;
export type AdminGetStockOutput = z.infer<typeof AdminGetStockOutputSchema>;
