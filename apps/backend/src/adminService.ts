import { ORPCError } from "@orpc/server";
import type { Transaction, AdminGetStockOutput } from "../../../shared/models.ts";
import type { ProductStore } from "./productStore.ts";
import type { StockEventStore } from "./stockEventStore.ts";
import type { TransactionStore } from "./transactionStore.ts";

export type AdminService = {
  exportTransactions: (password: string) => Promise<{ transactions: Transaction[] }>;
  getStock: (password: string) => Promise<AdminGetStockOutput>;
  setStock: (
    password: string,
    input: { productId: string; quantity?: number; note?: string }
  ) => Promise<AdminGetStockOutput>;
};

type CreateAdminServiceOptions = {
  transactionStore: TransactionStore;
  productStore: ProductStore;
  stockEventStore: StockEventStore;
  adminPanelPassword: string | undefined;
};

export function createAdminService({
  transactionStore,
  productStore,
  stockEventStore,
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

      if (typeof input.quantity === "number") {
        await stockEventStore.appendEvent({
          productId: input.productId,
          type: "manual_set",
          quantity: input.quantity,
          note: trimmedNote
        });
      } else if (trimmedNote) {
        await stockEventStore.appendEvent({
          productId: input.productId,
          type: "comment",
          quantity: 0,
          note: trimmedNote
        });
      } else {
        throw new ORPCError("BAD_REQUEST", {
          data: { message: "Either quantity or note is required." }
        });
      }

      return buildStockSnapshot();
    }
  };
}
