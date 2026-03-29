import { ORPCError } from "@orpc/server";
import { randomInt } from "node:crypto";
import type {
  CartItemInput,
  PriceCategory,
  Product,
  Transaction,
  TransactionItem,
  TransactionStatus
} from "../../../shared/models.ts";
import type { ProductStore } from "./productStore.ts";
import type { StockEventStore } from "./stockEventStore.ts";
import type { TransactionStore } from "./transactionStore.ts";
import type { MemberStore } from "./memberStore.ts";

function buildTransactionItems(
  products: Product[],
  priceCategories: PriceCategory[],
  items: CartItemInput[]
): TransactionItem[] {
  const productMap = new Map(products.map((product) => [product.id, product]));
  const categoryMap = new Map(
    priceCategories.map((category) => [category.id, category])
  );

  return items.map((item) => {
    const product = productMap.get(item.productId);
    if (!product || !product.active) {
      throw new ORPCError("BAD_REQUEST", {
        data: { message: `Unknown or inactive product: ${item.productId}` }
      });
    }

    const category = categoryMap.get(product.priceCategoryId);
    if (!category) {
      throw new ORPCError("BAD_REQUEST", {
        data: { message: `Unknown price category: ${product.priceCategoryId}` }
      });
    }

    const unitPrice = item.isMemberPrice
      ? category.priceMember
      : category.priceNonMember;
    return {
      productId: product.id,
      name: product.name,
      quantity: item.quantity,
      unitPrice,
      lineTotal: Number((unitPrice * item.quantity).toFixed(2)),
      isMemberPrice: item.isMemberPrice
    };
  });
}

function sumTotal(items: TransactionItem[]): number {
  return Number(
    items.reduce((total, item) => total + item.lineTotal, 0).toFixed(2)
  );
}

function createStructuredTransactionId(): string {
  const base = randomInt(0, 10_000_000_000);
  const checksumRaw = base % 97;
  const checksum = checksumRaw === 0 ? 97 : checksumRaw;
  return `${base.toString().padStart(10, "0")}${checksum
    .toString()
    .padStart(2, "0")}`;
}

function isUniqueConstraintError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return /unique constraint/i.test(error.message);
}

export type TransactionService = {
  startTransaction: (
    items: CartItemInput[],
    options?: { memberId?: string; creditToUse?: number }
  ) => Promise<Transaction>;
  startTopupTransaction: (memberId: string, amount: number) => Promise<Transaction>;
  finalizeTransaction: (
    id: string,
    status: Exclude<TransactionStatus, "pending">,
    options?: { reason?: string; memberId?: string; creditUsed?: number }
  ) => Promise<Transaction>;
};

export function createTransactionService(
  productStore: ProductStore,
  transactionStore: TransactionStore,
  stockEventStore: StockEventStore,
  memberStore: MemberStore
): TransactionService {
  return {
    async startTransaction(items, options) {
      const catalog = await productStore.listCatalog();
      const lineItems = buildTransactionItems(
        Object.values(catalog.products),
        Object.values(catalog.priceCategories),
        items
      );
      const total = sumTotal(lineItems);
      const createdAt = new Date().toISOString();

      let memberId: string | undefined;
      let memberName: string | undefined;
      let creditUsed = 0;

      if (options?.memberId) {
        const member = await memberStore.getById(options.memberId);
        if (!member || !member.active) {
          throw new ORPCError("BAD_REQUEST", {
            data: { message: "Selected member is not available." }
          });
        }

        memberId = member.id;
        memberName = member.displayName;

        const requestedCredit = options.creditToUse ?? 0;
        if (requestedCredit < 0) {
          throw new ORPCError("BAD_REQUEST", {
            data: { message: "Credit amount cannot be negative." }
          });
        }

        creditUsed = Number(Math.min(requestedCredit, member.balance, total).toFixed(2));
      }

      const externalAmount = Number((total - creditUsed).toFixed(2));

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const transaction: Transaction = {
          id: createStructuredTransactionId(),
          createdAt,
          status: "pending",
          type: "sale",
          memberId,
          memberName,
          creditUsed,
          externalAmount,
          total,
          items: lineItems
        };

        try {
          await transactionStore.create(transaction);
          return transaction;
        } catch (error) {
          if (attempt < 4 && isUniqueConstraintError(error)) {
            continue;
          }
          throw error;
        }
      }

      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        data: { message: "Could not create transaction id" }
      });
    },
    async startTopupTransaction(memberId, amount) {
      const member = await memberStore.getById(memberId);
      if (!member || !member.active) {
        throw new ORPCError("BAD_REQUEST", {
          data: { message: "Selected member is not available." }
        });
      }

      const safeAmount = Number(amount.toFixed(2));
      if (!Number.isFinite(safeAmount) || safeAmount <= 0) {
        throw new ORPCError("BAD_REQUEST", {
          data: { message: "Top-up amount must be positive." }
        });
      }

      const createdAt = new Date().toISOString();
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const transaction: Transaction = {
          id: createStructuredTransactionId(),
          createdAt,
          status: "pending",
          type: "credit_topup",
          memberId: member.id,
          memberName: member.displayName,
          creditUsed: 0,
          externalAmount: safeAmount,
          total: safeAmount,
          items: []
        };

        try {
          await transactionStore.create(transaction);
          return transaction;
        } catch (error) {
          if (attempt < 4 && isUniqueConstraintError(error)) {
            continue;
          }
          throw error;
        }
      }

      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        data: { message: "Could not create top-up transaction id" }
      });
    },
    async finalizeTransaction(id, status, options) {
      const existing = await transactionStore.getById(id);
      if (!existing) {
        throw new ORPCError("NOT_FOUND", { data: { message: "Transaction not found" } });
      }

      const memberId = options?.memberId ?? existing.memberId;
      const requestedCreditUsed = options?.creditUsed ?? existing.creditUsed ?? 0;
      const cappedCreditUsed = Number(
        Math.max(0, Math.min(requestedCreditUsed, existing.total)).toFixed(2)
      );
      const externalAmount = Number((existing.total - cappedCreditUsed).toFixed(2));

      if (status === "completed" && existing.type === "sale" && cappedCreditUsed > 0) {
        if (!memberId) {
          throw new ORPCError("BAD_REQUEST", {
            data: { message: "Credit usage requires a member account." }
          });
        }

        try {
          await memberStore.adjustBalance({
            memberId,
            delta: -cappedCreditUsed,
            reason: "checkout_debit",
            transactionId: existing.id,
            preventNegative: true
          });
        } catch (error) {
          if (error instanceof Error && error.message === "INSUFFICIENT_CREDIT") {
            throw new ORPCError("BAD_REQUEST", {
              data: { message: "Insufficient member credit." }
            });
          }
          if (error instanceof Error && error.message === "MEMBER_NOT_FOUND") {
            throw new ORPCError("BAD_REQUEST", {
              data: { message: "Member account not found." }
            });
          }
          throw error;
        }
      }

      if (status === "completed" && existing.type === "credit_topup") {
        if (!existing.memberId) {
          throw new ORPCError("BAD_REQUEST", {
            data: { message: "Top-up transaction has no member." }
          });
        }

        await memberStore.adjustBalance({
          memberId: existing.memberId,
          delta: existing.total,
          reason: "topup",
          transactionId: existing.id,
          preventNegative: true
        });
      }

      const member = memberId ? await memberStore.getById(memberId) : null;

      const transaction = await transactionStore.updateStatus(id, status, {
        reason: options?.reason,
        memberId: memberId ?? undefined,
        memberName: member?.displayName ?? existing.memberName,
        creditUsed: cappedCreditUsed,
        externalAmount
      });

      if (!transaction) {
        throw new ORPCError("NOT_FOUND", { data: { message: "Transaction not found" } });
      }

      if (existing.status !== "completed" && status === "completed" && existing.type === "sale") {
        for (const item of existing.items) {
          await stockEventStore.appendEvent({
            productId: item.productId,
            type: "sale_delta",
            quantity: -item.quantity,
            note: `Sale ${existing.id}`
          });
        }
      }

      return transaction;
    }
  };
}
