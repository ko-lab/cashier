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
  active: z.boolean().default(true)
});

export const StockEventTypeSchema = z.enum([
  "manual_set",
  "refill_delta",
  "sale_delta",
  "comment",
  "counted_ok",
  "active_set"
]);

export const StockEventSchema = z.object({
  id: z.string().min(1),
  productId: z.string().min(1),
  type: StockEventTypeSchema,
  quantity: z.number().int(),
  active: z.boolean().optional(),
  createdAt: z.string().min(1),
  note: z.string().optional(),
  transactionId: z.string().optional(),
  memberCreditEventId: z.string().optional()
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
    active: z.boolean().optional(),
    action: z.enum(["set", "refill", "comment", "counted_ok", "set_active"]).optional()
  })
  .refine(
    (input) =>
      input.action === "counted_ok" ||
      input.quantity !== undefined ||
      input.active !== undefined ||
      !!input.note?.trim(),
    {
      message: "Either quantity or note is required"
    }
  );

export const AdminStockItemSchema = z.object({
  productId: z.string().min(1),
  productName: z.string().min(1),
  quantity: z.number().int(),
  active: z.boolean(),
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

export const CustomerTypeSchema = z.enum(["member", "non_member"]);

export const MemberSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  customerType: CustomerTypeSchema.default("member"),
  active: z.boolean(),
  balance: z.number(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1)
});

export const CreditLedgerReasonSchema = z.enum([
  "topup",
  "checkout_debit",
  "admin_adjustment",
  "refund"
]);

export const CreditItemBreakdownSchema = z.object({
  productId: z.string().min(1),
  name: z.string().min(1),
  quantity: z.number().int().min(1),
  isMemberPrice: z.boolean().optional(),
  lineTotal: z.number().nonnegative(),
  creditAllocated: z.number().nonnegative()
});

export const CreditLedgerEntrySchema = z.object({
  id: z.string().min(1),
  memberId: z.string().min(1),
  delta: z.number(),
  balanceAfter: z.number(),
  reason: CreditLedgerReasonSchema,
  transactionId: z.string().optional(),
  note: z.string().optional(),
  itemBreakdown: z.array(CreditItemBreakdownSchema).optional(),
  stockEventIds: z.array(z.string().min(1)).optional(),
  createdAt: z.string().min(1)
});

export const MemberAuthInputSchema = z.object({
  pin: z
    .string()
    .min(4)
    .max(12)
    .regex(/^\d+$/, "PIN must contain only digits")
});

export const MemberAuthOutputSchema = z.object({
  member: MemberSchema
});

export const MemberListOutputSchema = z.object({
  members: z.array(MemberSchema)
});

export const AdminCreateMemberInputSchema = z.object({
  password: z.string().min(1),
  displayName: z.string().min(1).max(80),
  customerType: CustomerTypeSchema.default("member"),
  pin: z
    .string()
    .min(4)
    .max(12)
    .regex(/^\d+$/, "PIN must contain only digits")
});

export const AdminSetMemberPinInputSchema = z.object({
  password: z.string().min(1),
  memberId: z.string().min(1),
  pin: z
    .string()
    .min(4)
    .max(12)
    .regex(/^\d+$/, "PIN must contain only digits")
});

export const AdminSetMemberActiveInputSchema = z.object({
  password: z.string().min(1),
  memberId: z.string().min(1),
  active: z.boolean()
});

export const AdminTopupCreditInputSchema = z.object({
  password: z.string().min(1),
  memberId: z.string().min(1),
  amount: z.number().positive(),
  note: z.string().max(200).optional()
});

export const AdminMembersOutputSchema = z.object({
  members: z.array(MemberSchema)
});

export const AdminCreditLedgerInputSchema = z.object({
  password: z.string().min(1),
  memberId: z.string().min(1).optional()
});

export const AdminCreditLedgerOutputSchema = z.object({
  entries: z.array(CreditLedgerEntrySchema)
});

export const TransactionStatusSchema = z.enum(["pending", "completed", "canceled", "abandoned"]);

export const TransactionItemSchema = z.object({
  productId: z.string().min(1),
  name: z.string().min(1),
  quantity: z.number().int().min(1),
  unitPrice: z.number().nonnegative(),
  lineTotal: z.number().nonnegative(),
  isMemberPrice: z.boolean()
});

export const TransactionTypeSchema = z.enum(["sale", "credit_topup"]);

export const TransactionSchema = z.object({
  id: z.string().min(1),
  createdAt: z.string().min(1),
  status: TransactionStatusSchema,
  type: TransactionTypeSchema.default("sale"),
  abandonmentReason: z.string().optional(),
  memberId: z.string().optional(),
  memberName: z.string().optional(),
  creditUsed: z.number().nonnegative().optional(),
  externalAmount: z.number().nonnegative().optional(),
  total: z.number().nonnegative(),
  items: z.array(TransactionItemSchema)
});

export const StartTransactionInputSchema = z.object({
  items: z.array(CartItemInputSchema).min(1),
  memberId: z.string().min(1).optional(),
  creditToUse: z.number().nonnegative().optional()
});

export const FinalizeTransactionInputSchema = z.object({
  id: z.string().min(1),
  status: TransactionStatusSchema.exclude(["pending"]),
  reason: z.string().optional(),
  memberId: z.string().optional(),
  creditUsed: z.number().nonnegative().optional()
});

export const StartTopupTransactionInputSchema = z.object({
  memberId: z.string().min(1),
  amount: z.number().positive()
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
export type CustomerType = z.infer<typeof CustomerTypeSchema>;
export type Member = z.infer<typeof MemberSchema>;
export type Customer = Member;
export type CreditLedgerReason = z.infer<typeof CreditLedgerReasonSchema>;
export type CreditItemBreakdown = z.infer<typeof CreditItemBreakdownSchema>;
export type CreditLedgerEntry = z.infer<typeof CreditLedgerEntrySchema>;
export type MemberAuthInput = z.infer<typeof MemberAuthInputSchema>;
export type MemberAuthOutput = z.infer<typeof MemberAuthOutputSchema>;
export type MemberListOutput = z.infer<typeof MemberListOutputSchema>;
export type TransactionStatus = z.infer<typeof TransactionStatusSchema>;
export type TransactionType = z.infer<typeof TransactionTypeSchema>;
export type TransactionItem = z.infer<typeof TransactionItemSchema>;
export type Transaction = z.infer<typeof TransactionSchema>;
export type StartTransactionInput = z.infer<typeof StartTransactionInputSchema>;
export type FinalizeTransactionInput = z.infer<typeof FinalizeTransactionInputSchema>;
export type StartTopupTransactionInput = z.infer<typeof StartTopupTransactionInputSchema>;
export type AdminExportTransactionsInput = z.infer<
  typeof AdminExportTransactionsInputSchema
>;
export type AdminExportTransactionsOutput = z.infer<
  typeof AdminExportTransactionsOutputSchema
>;
export type AdminSetStockInput = z.infer<typeof AdminSetStockInputSchema>;
export type AdminStockItem = z.infer<typeof AdminStockItemSchema>;
export type AdminGetStockOutput = z.infer<typeof AdminGetStockOutputSchema>;
export type AdminCreateMemberInput = z.infer<typeof AdminCreateMemberInputSchema>;
export type AdminSetMemberPinInput = z.infer<typeof AdminSetMemberPinInputSchema>;
export type AdminSetMemberActiveInput = z.infer<typeof AdminSetMemberActiveInputSchema>;
export type AdminTopupCreditInput = z.infer<typeof AdminTopupCreditInputSchema>;
export type AdminMembersOutput = z.infer<typeof AdminMembersOutputSchema>;
export type AdminCreditLedgerInput = z.infer<typeof AdminCreditLedgerInputSchema>;
export type AdminCreditLedgerOutput = z.infer<typeof AdminCreditLedgerOutputSchema>;
