import { describe, expect, it, vi } from "vitest";
import { createAdminService } from "./adminService.ts";
import type { TransactionStore } from "./transactionStore.ts";
import type { Transaction } from "../../../shared/models.ts";

function makeTransactionStore(transactions: Transaction[]): TransactionStore {
  return {
    create: vi.fn(async () => undefined),
    getById: vi.fn(async () => null),
    updateStatus: vi.fn(async () => null),
    list: vi.fn(async () => transactions)
  };
}

describe("admin service", () => {
  it("returns all transactions for a valid password", async () => {
    const transactions: Transaction[] = [
      {
        id: "tx-1",
        createdAt: "2026-03-07T10:00:00.000Z",
        status: "completed",
        total: 4,
        items: [
          {
            productId: "cola",
            name: "Cola",
            quantity: 1,
            unitPrice: 4,
            lineTotal: 4,
            isMemberPrice: false
          }
        ]
      }
    ];
    const service = createAdminService({
      transactionStore: makeTransactionStore(transactions),
      adminPanelPassword: "secret"
    });

    const result = await service.exportTransactions("secret");
    expect(result.transactions).toEqual(transactions);
  });

  it("rejects invalid passwords", async () => {
    const service = createAdminService({
      transactionStore: makeTransactionStore([]),
      adminPanelPassword: "secret"
    });

    await expect(service.exportTransactions("wrong")).rejects.toMatchObject({
      code: "UNAUTHORIZED"
    });
  });

  it("rejects export when no admin password is configured", async () => {
    const service = createAdminService({
      transactionStore: makeTransactionStore([]),
      adminPanelPassword: undefined
    });

    await expect(service.exportTransactions("anything")).rejects.toMatchObject({
      code: "FORBIDDEN"
    });
  });
});
