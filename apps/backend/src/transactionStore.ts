import path from "node:path";
import { readJson, writeJson } from "./storage";
import type { Transaction } from "../../../shared/models";

export type TransactionStore = {
  listTransactions: () => Promise<Transaction[]>;
  saveTransactions: (transactions: Transaction[]) => Promise<void>;
};

export function createTransactionStore(dataDir: string): TransactionStore {
  const transactionsPath = path.join(dataDir, "transactions.json");

  return {
    async listTransactions() {
      return readJson<Transaction[]>(transactionsPath, []);
    },
    async saveTransactions(transactions) {
      await writeJson(transactionsPath, transactions);
    }
  };
}
