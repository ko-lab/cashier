import { describe, expect, it, vi } from "vitest";
import { createAdminService } from "./adminService.ts";
import type { Member, Transaction } from "../../../shared/models.ts";
import type { TransactionStore } from "./transactionStore.ts";
import type { ProductStore } from "./productStore.ts";
import type { StockEventStore } from "./stockEventStore.ts";
import type { MemberStore } from "./memberStore.ts";

function makeTransactionStore(transactions: Transaction[]): TransactionStore {
  return {
    create: vi.fn(async () => undefined),
    getById: vi.fn(async () => null),
    updateStatus: vi.fn(async () => null),
    list: vi.fn(async () => transactions),
    recordTransactionOrigin: vi.fn(async () => undefined)
  };
}

function makeService(transactions: Transaction[], adminPanelPassword?: string) {
  const productStore = {
    listCatalog: vi.fn(async () => ({ products: {}, priceCategories: {} }))
  } as unknown as ProductStore;

  const stockEventStore = {
    listEvents: vi.fn(async () => []),
    appendEvent: vi.fn(async () => undefined)
  } as unknown as StockEventStore;

  const memberStore = {
    listMembers: vi.fn(async (): Promise<Member[]> => []),
    getById: vi.fn(async () => null),
    authenticateByPin: vi.fn(async () => null),
    createMember: vi.fn(async () => {
      throw new Error("not implemented");
    }),
    setMemberPin: vi.fn(async () => null),
    setMemberActive: vi.fn(async () => null),
    adjustBalance: vi.fn(async () => {
      throw new Error("not implemented");
    }),
    listLedger: vi.fn(async () => [])
  } as unknown as MemberStore;

  return createAdminService({
    transactionStore: makeTransactionStore(transactions),
    productStore,
    stockEventStore,
    memberStore,
    adminPanelPassword
  });
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
    const service = makeService(transactions, "secret");

    const result = await service.exportTransactions("secret");
    expect(result.transactions).toEqual(transactions);
  });

  it("rejects invalid passwords", async () => {
    const service = makeService([], "secret");

    await expect(service.exportTransactions("wrong")).rejects.toMatchObject({
      code: "UNAUTHORIZED"
    });
  });

  it("rejects export when no admin password is configured", async () => {
    const service = makeService([]);

    await expect(service.exportTransactions("anything")).rejects.toMatchObject({
      code: "FORBIDDEN"
    });
  });
});
