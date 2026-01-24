import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ORPCError } from "@orpc/server";
import { createProductStore } from "./productStore";
import { createTransactionStore } from "./transactionStore";
import { createTransactionService } from "./transactionService";
import { writeJson } from "./storage";
import type { PriceCategory, Product } from "../../../shared/models";

const priceCategories: PriceCategory[] = [
  {
    id: "beer",
    name: "Beer",
    priceMember: 3,
    priceNonMember: 4
  }
];

const products: Product[] = [
  {
    id: "cola",
    name: "Cola",
    priceCategoryId: "beer",
    inventoryCount: 10,
    active: true
  }
];

describe("transaction service", () => {
  let dataDir: string;

  beforeEach(async () => {
    dataDir = await mkdtemp(path.join(tmpdir(), "pos-data-"));
    await writeJson(path.join(dataDir, "products.json"), {
      products,
      priceCategories
    });
  });

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
  });

  it("creates a pending transaction and persists it", async () => {
    const productStore = createProductStore(dataDir);
    const transactionStore = createTransactionStore(dataDir);
    const service = createTransactionService(productStore, transactionStore);

    const transaction = await service.startTransaction([
      { productId: "cola", quantity: 2, isMemberPrice: true }
    ]);

    expect(transaction.status).toBe("pending");
    expect(transaction.total).toBe(6);

    const saved = await transactionStore.getById(transaction.id);
    expect(saved?.id).toBe(transaction.id);
  });

  it("finalizes a transaction", async () => {
    const productStore = createProductStore(dataDir);
    const transactionStore = createTransactionStore(dataDir);
    const service = createTransactionService(productStore, transactionStore);

    const transaction = await service.startTransaction([
      { productId: "cola", quantity: 1, isMemberPrice: false }
    ]);

    const finalized = await service.finalizeTransaction(transaction.id, "completed");
    expect(finalized.status).toBe("completed");

    const saved = await transactionStore.getById(transaction.id);
    expect(saved?.status).toBe("completed");
  });

  it("rejects unknown products", async () => {
    const productStore = createProductStore(dataDir);
    const transactionStore = createTransactionStore(dataDir);
    const service = createTransactionService(productStore, transactionStore);

    await expect(
      service.startTransaction([
        { productId: "unknown", quantity: 1, isMemberPrice: false }
      ])
    ).rejects.toBeInstanceOf(ORPCError);
  });
});
