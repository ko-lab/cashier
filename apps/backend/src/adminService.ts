import { ORPCError } from "@orpc/server";
import type { Transaction } from "../../../shared/models.ts";
import type { TransactionStore } from "./transactionStore.ts";

export type AdminService = {
  exportTransactions: (password: string) => Promise<{ transactions: Transaction[] }>;
};

type CreateAdminServiceOptions = {
  transactionStore: TransactionStore;
  adminPanelPassword: string | undefined;
};

export function createAdminService({
  transactionStore,
  adminPanelPassword
}: CreateAdminServiceOptions): AdminService {
  return {
    async exportTransactions(password) {
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

      const transactions = await transactionStore.list();
      return { transactions };
    }
  };
}
