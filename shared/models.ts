import * as z from "zod";

export const ProductSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  priceMember: z.number().nonnegative(),
  priceNonMember: z.number().nonnegative(),
  inventoryCount: z.number().int().nonnegative(),
  active: z.boolean()
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

export type Product = z.infer<typeof ProductSchema>;
export type CartItemInput = z.infer<typeof CartItemInputSchema>;
export type TransactionStatus = z.infer<typeof TransactionStatusSchema>;
export type TransactionItem = z.infer<typeof TransactionItemSchema>;
export type Transaction = z.infer<typeof TransactionSchema>;
export type StartTransactionInput = z.infer<typeof StartTransactionInputSchema>;
export type FinalizeTransactionInput = z.infer<typeof FinalizeTransactionInputSchema>;
