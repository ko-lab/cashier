import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ORPCError } from "@orpc/server";
import { createProductStore } from "./productStore.ts";
import { createTransactionStore } from "./transactionStore.ts";
import { createTransactionService } from "./transactionService.ts";
import { writeJson } from "./storage.ts";
import { createStockEventStore } from "./stockEventStore.ts";
import type { PriceCategory, Product } from "../../../shared/models.ts";

const priceCategories: Record<string, PriceCategory> = {
  beer: {
    id: "beer",
    name: "Beer",
    priceMember: 3,
    priceNonMember: 4
  }
};

const products: Record<string, Product> = {
  cola: {
    id: "cola",
    name: "Cola",
    priceCategoryId: "beer",
    inventoryCount: 10,
    active: true
  }
};

describe("transaction service", () => {
  let dataDir: string;
  let catalogDir: string;

  beforeEach(async () => {
    dataDir = await mkdtemp(path.join(tmpdir(), "pos-data-"));
    catalogDir = path.join(dataDir, "catalog");
    await writeJson(path.join(catalogDir, "products.json"), {
      products,
      priceCategories
    });
  });

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
  });

  it("creates a pending transaction and persists it", async () => {
    const stockEventStore = createStockEventStore(dataDir);
    const productStore = createProductStore(catalogDir, stockEventStore);
    const transactionStore = createTransactionStore(dataDir);
    const service = createTransactionService(
      productStore,
      transactionStore,
      stockEventStore
    );

    const transaction = await service.startTransaction([
      { productId: "cola", quantity: 2, isMemberPrice: true }
    ]);

    expect(transaction.status).toBe("pending");
    expect(transaction.total).toBe(6);
    expect(transaction.id).toMatch(/^\d{12}$/);

    const saved = await transactionStore.getById(transaction.id);
    expect(saved?.id).toBe(transaction.id);
  });

  it("finalizes a transaction", async () => {
    const stockEventStore = createStockEventStore(dataDir);
    const productStore = createProductStore(catalogDir, stockEventStore);
    const transactionStore = createTransactionStore(dataDir);
    const service = createTransactionService(
      productStore,
      transactionStore,
      stockEventStore
    );

    const transaction = await service.startTransaction([
      { productId: "cola", quantity: 1, isMemberPrice: false }
    ]);

    const finalized = await service.finalizeTransaction(transaction.id, "completed");
    expect(finalized.status).toBe("completed");

    const saved = await transactionStore.getById(transaction.id);
    expect(saved?.status).toBe("completed");
  });

  it("rejects unknown products", async () => {
    const stockEventStore = createStockEventStore(dataDir);
    const productStore = createProductStore(catalogDir, stockEventStore);
    const transactionStore = createTransactionStore(dataDir);
    const service = createTransactionService(
      productStore,
      transactionStore,
      stockEventStore
    );

    await expect(
      service.startTransaction([
        { productId: "unknown", quantity: 1, isMemberPrice: false }
      ])
    ).rejects.toBeInstanceOf(ORPCError);
  });
});
