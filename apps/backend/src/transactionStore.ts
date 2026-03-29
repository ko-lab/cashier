import path from "node:path";
import { mkdirSync } from "node:fs";
import Database from "better-sqlite3";
import type { Transaction, TransactionStatus } from "../../../shared/models.ts";

export type TransactionStore = {
  create: (transaction: Transaction) => Promise<void>;
  getById: (id: string) => Promise<Transaction | null>;
  updateStatus: (
    id: string,
    status: Exclude<TransactionStatus, "pending">,
    options?: {
      reason?: string;
      memberId?: string;
      memberName?: string;
      creditUsed?: number;
      externalAmount?: number;
    }
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
      type TEXT NOT NULL DEFAULT 'sale',
      abandonment_reason TEXT,
      member_id TEXT,
      member_name TEXT,
      credit_used REAL,
      external_amount REAL,
      total REAL NOT NULL,
      items_json TEXT NOT NULL
    );
  `);

  const tableInfo = db
    .prepare("PRAGMA table_info(transactions)")
    .all() as { name: string }[];
  const hasAbandonmentReasonColumn = tableInfo.some(
    (column) => column.name === "abandonment_reason"
  );
  if (!hasAbandonmentReasonColumn) {
    db.exec("ALTER TABLE transactions ADD COLUMN abandonment_reason TEXT");
  }
  if (!tableInfo.some((column) => column.name === "type")) {
    db.exec("ALTER TABLE transactions ADD COLUMN type TEXT NOT NULL DEFAULT 'sale'");
  }
  if (!tableInfo.some((column) => column.name === "member_id")) {
    db.exec("ALTER TABLE transactions ADD COLUMN member_id TEXT");
  }
  if (!tableInfo.some((column) => column.name === "member_name")) {
    db.exec("ALTER TABLE transactions ADD COLUMN member_name TEXT");
  }
  if (!tableInfo.some((column) => column.name === "credit_used")) {
    db.exec("ALTER TABLE transactions ADD COLUMN credit_used REAL");
  }
  if (!tableInfo.some((column) => column.name === "external_amount")) {
    db.exec("ALTER TABLE transactions ADD COLUMN external_amount REAL");
  }

  const insertTransaction = db.prepare(`
    INSERT INTO transactions (id, created_at, status, type, abandonment_reason, member_id, member_name, credit_used, external_amount, total, items_json)
    VALUES (@id, @createdAt, @status, @type, @abandonmentReason, @memberId, @memberName, @creditUsed, @externalAmount, @total, @itemsJson)
  `);
  const selectById = db.prepare(
    "SELECT id, created_at, status, type, abandonment_reason, member_id, member_name, credit_used, external_amount, total, items_json FROM transactions WHERE id = ?"
  );
  const updateStatus = db.prepare(
    "UPDATE transactions SET status = ?, abandonment_reason = ?, member_id = ?, member_name = ?, credit_used = ?, external_amount = ? WHERE id = ?"
  );
  const listAll = db.prepare(
    "SELECT id, created_at, status, type, abandonment_reason, member_id, member_name, credit_used, external_amount, total, items_json FROM transactions ORDER BY created_at DESC"
  );

  const mapRow = (row: {
    id: string;
    created_at: string;
    status: TransactionStatus;
    type?: "sale" | "credit_topup" | null;
    abandonment_reason?: string | null;
    member_id?: string | null;
    member_name?: string | null;
    credit_used?: number | null;
    external_amount?: number | null;
    total: number;
    items_json: string;
  }): Transaction => ({
    id: row.id,
    createdAt: row.created_at,
    status: row.status,
    type: row.type === "credit_topup" ? "credit_topup" : "sale",
    abandonmentReason: row.abandonment_reason ?? undefined,
    memberId: row.member_id ?? undefined,
    memberName: row.member_name ?? undefined,
    creditUsed: row.credit_used ?? undefined,
    externalAmount: row.external_amount ?? undefined,
    total: row.total,
    items: JSON.parse(row.items_json) as Transaction["items"]
  });

  return {
    async create(transaction) {
      insertTransaction.run({
        id: transaction.id,
        createdAt: transaction.createdAt,
        status: transaction.status,
        type: transaction.type ?? "sale",
        abandonmentReason: transaction.abandonmentReason ?? null,
        memberId: transaction.memberId ?? null,
        memberName: transaction.memberName ?? null,
        creditUsed: transaction.creditUsed ?? null,
        externalAmount: transaction.externalAmount ?? null,
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
            type?: "sale" | "credit_topup" | null;
            abandonment_reason?: string | null;
            member_id?: string | null;
            member_name?: string | null;
            credit_used?: number | null;
            external_amount?: number | null;
            total: number;
            items_json: string;
          }
        | undefined;
      return row ? mapRow(row) : null;
    },
    async updateStatus(id, status, options) {
      updateStatus.run(
        status,
        options?.reason ?? null,
        options?.memberId ?? null,
        options?.memberName ?? null,
        options?.creditUsed ?? null,
        options?.externalAmount ?? null,
        id
      );
      return this.getById(id);
    },
    async list() {
      const rows = listAll.all() as {
        id: string;
        created_at: string;
        status: TransactionStatus;
        type?: "sale" | "credit_topup" | null;
        abandonment_reason?: string | null;
        member_id?: string | null;
        member_name?: string | null;
        credit_used?: number | null;
        external_amount?: number | null;
        total: number;
        items_json: string;
      }[];
      return rows.map(mapRow);
    }
  };
}
