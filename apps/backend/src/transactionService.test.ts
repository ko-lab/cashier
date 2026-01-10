import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ORPCError } from "@orpc/server";
import { createProductStore } from "./productStore";
import { createTransactionStore } from "./transactionStore";
import { createTransactionService } from "./transactionService";
import { writeJson } from "./storage";
import type { Product } from "../../../shared/models";

const products: Product[] = [
  {
    id: "cola",
    name: "Cola",
    priceMember: 1,
    priceNonMember: 1.5,
    inventoryCount: 10,
    active: true
  }
];

describe("transaction service", () => {
  let dataDir: string;

  beforeEach(async () => {
    dataDir = await mkdtemp(path.join(tmpdir(), "pos-data-"));
    await writeJson(path.join(dataDir, "products.json"), products);
    await writeJson(path.join(dataDir, "transactions.json"), []);
  });

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
  });

  it("creates a pending transaction and persists it", async () => {
    const productStore = createProductStore(dataDir);
    const transactionStore = createTransactionStore(dataDir);
    const service = createTransactionService(productStore, transactionStore);

    const transaction = await service.startTransaction(
      [{ productId: "cola", quantity: 2 }],
      true
    );

    expect(transaction.status).toBe("pending");
    expect(transaction.total).toBe(2);

    const saved = await transactionStore.listTransactions();
    expect(saved).toHaveLength(1);
    expect(saved[0].id).toBe(transaction.id);
  });

  it("finalizes a transaction", async () => {
    const productStore = createProductStore(dataDir);
    const transactionStore = createTransactionStore(dataDir);
    const service = createTransactionService(productStore, transactionStore);

    const transaction = await service.startTransaction(
      [{ productId: "cola", quantity: 1 }],
      false
    );

    const finalized = await service.finalizeTransaction(transaction.id, "completed");
    expect(finalized.status).toBe("completed");

    const saved = await transactionStore.listTransactions();
    expect(saved[0].status).toBe("completed");
  });

  it("rejects unknown products", async () => {
    const productStore = createProductStore(dataDir);
    const transactionStore = createTransactionStore(dataDir);
    const service = createTransactionService(productStore, transactionStore);

    await expect(
      service.startTransaction([{ productId: "unknown", quantity: 1 }], false)
    ).rejects.toBeInstanceOf(ORPCError);
  });
});
