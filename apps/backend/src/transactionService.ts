import { ORPCError } from "@orpc/server";
import { randomUUID } from "node:crypto";
import type {
  CartItemInput,
  Product,
  Transaction,
  TransactionItem,
  TransactionStatus
} from "../../../shared/models";
import type { ProductStore } from "./productStore";
import type { TransactionStore } from "./transactionStore";

function buildTransactionItems(
  products: Product[],
  items: CartItemInput[],
  isMemberPrice: boolean
): TransactionItem[] {
  const productMap = new Map(products.map((product) => [product.id, product]));

  return items.map((item) => {
    const product = productMap.get(item.productId);
    if (!product || !product.active) {
      throw new ORPCError("BAD_REQUEST", {
        data: { message: `Unknown or inactive product: ${item.productId}` }
      });
    }

    const unitPrice = isMemberPrice ? product.priceMember : product.priceNonMember;
    return {
      productId: product.id,
      name: product.name,
      quantity: item.quantity,
      unitPrice,
      lineTotal: Number((unitPrice * item.quantity).toFixed(2))
    };
  });
}

function sumTotal(items: TransactionItem[]): number {
  return Number(
    items.reduce((total, item) => total + item.lineTotal, 0).toFixed(2)
  );
}

export type TransactionService = {
  startTransaction: (
    items: CartItemInput[],
    isMemberPrice: boolean
  ) => Promise<Transaction>;
  finalizeTransaction: (
    id: string,
    status: Exclude<TransactionStatus, "pending">
  ) => Promise<Transaction>;
};

export function createTransactionService(
  productStore: ProductStore,
  transactionStore: TransactionStore
): TransactionService {
  return {
    async startTransaction(items, isMemberPrice) {
      const products = await productStore.listProducts();
      const lineItems = buildTransactionItems(products, items, isMemberPrice);
      const total = sumTotal(lineItems);

      const transaction: Transaction = {
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        status: "pending",
        isMemberPrice,
        total,
        items: lineItems
      };

      const transactions = await transactionStore.listTransactions();
      transactions.push(transaction);
      await transactionStore.saveTransactions(transactions);

      return transaction;
    },
    async finalizeTransaction(id, status) {
      const transactions = await transactionStore.listTransactions();
      const transaction = transactions.find((entry) => entry.id === id);

      if (!transaction) {
        throw new ORPCError("NOT_FOUND", { data: { message: "Transaction not found" } });
      }

      transaction.status = status;
      await transactionStore.saveTransactions(transactions);

      return transaction;
    }
  };
}
