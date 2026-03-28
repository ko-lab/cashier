import { ORPCError } from "@orpc/server";
import { randomUUID } from "node:crypto";
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

export type TransactionService = {
  startTransaction: (items: CartItemInput[]) => Promise<Transaction>;
  finalizeTransaction: (
    id: string,
    status: Exclude<TransactionStatus, "pending">
  ) => Promise<Transaction>;
};

export function createTransactionService(
  productStore: ProductStore,
  transactionStore: TransactionStore,
  stockEventStore: StockEventStore
): TransactionService {
  return {
    async startTransaction(items) {
      const catalog = await productStore.listCatalog();
      const lineItems = buildTransactionItems(
        Object.values(catalog.products),
        Object.values(catalog.priceCategories),
        items
      );
      const total = sumTotal(lineItems);

      const transaction: Transaction = {
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        status: "pending",
        total,
        items: lineItems
      };

      await transactionStore.create(transaction);

      return transaction;
    },
    async finalizeTransaction(id, status) {
      const existing = await transactionStore.getById(id);
      if (!existing) {
        throw new ORPCError("NOT_FOUND", { data: { message: "Transaction not found" } });
      }

      const transaction = await transactionStore.updateStatus(id, status);

      if (!transaction) {
        throw new ORPCError("NOT_FOUND", { data: { message: "Transaction not found" } });
      }

      if (existing.status !== "completed" && status === "completed") {
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
