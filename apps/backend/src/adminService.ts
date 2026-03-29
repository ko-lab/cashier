import { ORPCError } from "@orpc/server";
import type {
  AdminCreditLedgerOutput,
  AdminGetStockOutput,
  AdminMembersOutput,
  Member,
  Transaction
} from "../../../shared/models.ts";
import type { ProductStore } from "./productStore.ts";
import type { StockEventStore } from "./stockEventStore.ts";
import type { TransactionStore } from "./transactionStore.ts";
import type { MemberStore } from "./memberStore.ts";

export type AdminService = {
  exportTransactions: (password: string) => Promise<{ transactions: Transaction[] }>;
  getStock: (password: string) => Promise<AdminGetStockOutput>;
  setStock: (
    password: string,
    input: {
      productId: string;
      quantity?: number;
      note?: string;
      action?: "set" | "comment" | "counted_ok";
    }
  ) => Promise<AdminGetStockOutput>;
  authenticateMemberByPin: (pin: string) => Promise<Member>;
  listMembers: (password: string) => Promise<AdminMembersOutput>;
  createMember: (
    password: string,
    displayName: string,
    pin: string
  ) => Promise<AdminMembersOutput>;
  setMemberPin: (password: string, memberId: string, pin: string) => Promise<AdminMembersOutput>;
  setMemberActive: (
    password: string,
    memberId: string,
    active: boolean
  ) => Promise<AdminMembersOutput>;
  topupCredit: (
    password: string,
    memberId: string,
    amount: number,
    note?: string
  ) => Promise<AdminMembersOutput>;
  creditLedger: (password: string, memberId?: string) => Promise<AdminCreditLedgerOutput>;
};

type CreateAdminServiceOptions = {
  transactionStore: TransactionStore;
  productStore: ProductStore;
  stockEventStore: StockEventStore;
  memberStore: MemberStore;
  adminPanelPassword: string | undefined;
};

export function createAdminService({
  transactionStore,
  productStore,
  stockEventStore,
  memberStore,
  adminPanelPassword
}: CreateAdminServiceOptions): AdminService {
  const assertPassword = (password: string) => {
    if (!adminPanelPassword) {
      throw new ORPCError("FORBIDDEN", {
        data: { message: "Admin panel is not configured." }
      });
    }

    if (password !== adminPanelPassword) {
      throw new ORPCError("UNAUTHORIZED", {
        data: { message: "Invalid admin password." }
      });
    }
  };

  const buildStockSnapshot = async (): Promise<AdminGetStockOutput> => {
    const catalog = await productStore.listCatalog();
    const events = await stockEventStore.listEvents();

    const items = Object.values(catalog.products)
      .map((product) => {
        const latest = [...events]
          .reverse()
          .find((event) => event.productId === product.id);

        return {
          productId: product.id,
          productName: product.name,
          quantity: product.inventoryCount,
          updatedAt: latest?.createdAt
        };
      })
      .sort((a, b) => a.productName.localeCompare(b.productName));

    return {
      items,
      events: [...events].reverse().slice(0, 100)
    };
  };

  const buildMembersSnapshot = async (): Promise<AdminMembersOutput> => {
    const members = await memberStore.listMembers();
    return { members };
  };

  return {
    async exportTransactions(password) {
      assertPassword(password);
      const transactions = await transactionStore.list();
      return { transactions };
    },
    async getStock(password) {
      assertPassword(password);
      return buildStockSnapshot();
    },
    async setStock(password, input) {
      assertPassword(password);

      const catalog = await productStore.listCatalog();
      if (!catalog.products[input.productId]) {
        throw new ORPCError("BAD_REQUEST", {
          data: { message: `Unknown product: ${input.productId}` }
        });
      }

      const trimmedNote = input.note?.trim();
      if (trimmedNote && /[;,]/.test(trimmedNote)) {
        throw new ORPCError("BAD_REQUEST", {
          data: { message: "Note cannot contain commas or semicolons." }
        });
      }

      const action = input.action ?? (typeof input.quantity === "number" ? "set" : "comment");

      if (action === "counted_ok") {
        const countedQuantity =
          typeof input.quantity === "number"
            ? input.quantity
            : catalog.products[input.productId].inventoryCount;

        await stockEventStore.appendEvent({
          productId: input.productId,
          type: "counted_ok",
          quantity: countedQuantity,
          note: trimmedNote || "Counted and correct"
        });
      } else if (action === "set" && typeof input.quantity === "number") {
        await stockEventStore.appendEvent({
          productId: input.productId,
          type: "manual_set",
          quantity: input.quantity,
          note: trimmedNote
        });
      } else if (action === "comment" && trimmedNote) {
        await stockEventStore.appendEvent({
          productId: input.productId,
          type: "comment",
          quantity: 0,
          note: trimmedNote
        });
      } else {
        throw new ORPCError("BAD_REQUEST", {
          data: { message: "Invalid stock action payload." }
        });
      }

      return buildStockSnapshot();
    },
    async authenticateMemberByPin(pin) {
      const member = await memberStore.authenticateByPin(pin);
      if (!member) {
        throw new ORPCError("UNAUTHORIZED", {
          data: { message: "Invalid member PIN." }
        });
      }
      return member;
    },
    async listMembers(password) {
      assertPassword(password);
      return buildMembersSnapshot();
    },
    async createMember(password, displayName, pin) {
      assertPassword(password);
      await memberStore.createMember(displayName, pin);
      return buildMembersSnapshot();
    },
    async setMemberPin(password, memberId, pin) {
      assertPassword(password);
      const updated = await memberStore.setMemberPin(memberId, pin);
      if (!updated) {
        throw new ORPCError("NOT_FOUND", { data: { message: "Member not found." } });
      }
      return buildMembersSnapshot();
    },
    async setMemberActive(password, memberId, active) {
      assertPassword(password);
      const updated = await memberStore.setMemberActive(memberId, active);
      if (!updated) {
        throw new ORPCError("NOT_FOUND", { data: { message: "Member not found." } });
      }
      return buildMembersSnapshot();
    },
    async topupCredit(password, memberId, amount, note) {
      assertPassword(password);
      try {
        await memberStore.adjustBalance({
          memberId,
          delta: Number(amount.toFixed(2)),
          reason: "topup",
          note: note?.trim(),
          preventNegative: true
        });
      } catch (error) {
        if (error instanceof Error && error.message === "MEMBER_NOT_FOUND") {
          throw new ORPCError("NOT_FOUND", { data: { message: "Member not found." } });
        }
        throw error;
      }
      return buildMembersSnapshot();
    },
    async creditLedger(password, memberId) {
      assertPassword(password);
      const entries = await memberStore.listLedger(memberId);
      return { entries };
    }
  };
}
