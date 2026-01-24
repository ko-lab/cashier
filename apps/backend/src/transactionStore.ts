import path from "node:path";
import { mkdirSync } from "node:fs";
import Database from "better-sqlite3";
import type { Transaction, TransactionStatus } from "../../../shared/models.ts";

export type TransactionStore = {
  create: (transaction: Transaction) => Promise<void>;
  getById: (id: string) => Promise<Transaction | null>;
  updateStatus: (
    id: string,
    status: Exclude<TransactionStatus, "pending">
  ) => Promise<Transaction | null>;
  list: () => Promise<Transaction[]>;
};

export function createTransactionStore(dataDir: string): TransactionStore {
  mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, "transactions.sqlite");
  const db = new Database(dbPath);

  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      status TEXT NOT NULL,
      total REAL NOT NULL,
      items_json TEXT NOT NULL
    );
  `);

  const insertTransaction = db.prepare(`
    INSERT INTO transactions (id, created_at, status, total, items_json)
    VALUES (@id, @createdAt, @status, @total, @itemsJson)
  `);
  const selectById = db.prepare(
    "SELECT id, created_at, status, total, items_json FROM transactions WHERE id = ?"
  );
  const updateStatus = db.prepare(
    "UPDATE transactions SET status = ? WHERE id = ?"
  );
  const listAll = db.prepare(
    "SELECT id, created_at, status, total, items_json FROM transactions ORDER BY created_at DESC"
  );

  const mapRow = (row: {
    id: string;
    created_at: string;
    status: TransactionStatus;
    total: number;
    items_json: string;
  }): Transaction => ({
    id: row.id,
    createdAt: row.created_at,
    status: row.status,
    total: row.total,
    items: JSON.parse(row.items_json) as Transaction["items"]
  });

  return {
    async create(transaction) {
      insertTransaction.run({
        id: transaction.id,
        createdAt: transaction.createdAt,
        status: transaction.status,
        total: transaction.total,
        itemsJson: JSON.stringify(transaction.items)
      });
    },
    async getById(id) {
      const row = selectById.get(id) as
        | {
            id: string;
            created_at: string;
            status: TransactionStatus;
            total: number;
            items_json: string;
          }
        | undefined;
      return row ? mapRow(row) : null;
    },
    async updateStatus(id, status) {
      updateStatus.run(status, id);
      return this.getById(id);
    },
    async list() {
      const rows = listAll.all() as {
        id: string;
        created_at: string;
        status: TransactionStatus;
        total: number;
        items_json: string;
      }[];
      return rows.map(mapRow);
    }
  };
}
