import path from "node:path";
import { mkdirSync } from "node:fs";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import Database from "better-sqlite3";
import type {
  CreditItemBreakdown,
  CreditLedgerEntry,
  CreditLedgerReason,
  Member
} from "../../../shared/models.ts";

export type MemberStore = {
  listMembers: () => Promise<Member[]>;
  getById: (id: string) => Promise<Member | null>;
  authenticateByPin: (pin: string) => Promise<Member | null>;
  createMember: (displayName: string, pin: string) => Promise<Member>;
  setMemberPin: (memberId: string, pin: string) => Promise<Member | null>;
  setMemberActive: (memberId: string, active: boolean) => Promise<Member | null>;
  adjustBalance: (input: {
    eventId?: string;
    memberId: string;
    delta: number;
    reason: CreditLedgerReason;
    note?: string;
    transactionId?: string;
    itemBreakdown?: CreditItemBreakdown[];
    stockEventIds?: string[];
    preventNegative?: boolean;
  }) => Promise<{ member: Member; entry: CreditLedgerEntry }>;
  listLedger: (memberId?: string) => Promise<CreditLedgerEntry[]>;
};

function hashPin(pin: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pin, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPin(pin: string, storedHash: string): boolean {
  const [salt, hashHex] = storedHash.split(":");
  if (!salt || !hashHex) {
    return false;
  }

  const computed = scryptSync(pin, salt, 64);
  const stored = Buffer.from(hashHex, "hex");
  if (computed.length !== stored.length) {
    return false;
  }

  return timingSafeEqual(computed, stored);
}

export function createMemberStore(dataDir: string): MemberStore {
  mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, "members.sqlite");
  const db = new Database(dbPath);

  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      pin_hash TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      balance REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS credit_ledger (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL,
      delta REAL NOT NULL,
      balance_after REAL NOT NULL,
      reason TEXT NOT NULL,
      transaction_id TEXT,
      note TEXT,
      item_breakdown_json TEXT,
      stock_event_ids_json TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(member_id) REFERENCES members(id)
    );

    CREATE INDEX IF NOT EXISTS idx_credit_ledger_member_id_created_at
      ON credit_ledger(member_id, created_at DESC);
  `);

  const creditTableInfo = db
    .prepare("PRAGMA table_info(credit_ledger)")
    .all() as { name: string }[];
  if (!creditTableInfo.some((column) => column.name === "item_breakdown_json")) {
    db.exec("ALTER TABLE credit_ledger ADD COLUMN item_breakdown_json TEXT");
  }
  if (!creditTableInfo.some((column) => column.name === "stock_event_ids_json")) {
    db.exec("ALTER TABLE credit_ledger ADD COLUMN stock_event_ids_json TEXT");
  }

  const insertMember = db.prepare(`
    INSERT INTO members (id, display_name, pin_hash, active, balance, created_at, updated_at)
    VALUES (@id, @displayName, @pinHash, @active, @balance, @createdAt, @updatedAt)
  `);

  const selectMemberById = db.prepare(`
    SELECT id, display_name, active, balance, created_at, updated_at
    FROM members
    WHERE id = ?
  `);

  const selectMemberByPin = db.prepare(`
    SELECT id, display_name, pin_hash, active, balance, created_at, updated_at
    FROM members
    WHERE active = 1
  `);

  const listMembers = db.prepare(`
    SELECT id, display_name, active, balance, created_at, updated_at
    FROM members
    ORDER BY display_name COLLATE NOCASE ASC
  `);

  const updateMemberPin = db.prepare(`
    UPDATE members
    SET pin_hash = ?, updated_at = ?
    WHERE id = ?
  `);

  const updateMemberActive = db.prepare(`
    UPDATE members
    SET active = ?, updated_at = ?
    WHERE id = ?
  `);

  const selectMemberForUpdate = db.prepare(`
    SELECT id, display_name, active, balance, created_at, updated_at
    FROM members
    WHERE id = ?
  `);

  const updateMemberBalance = db.prepare(`
    UPDATE members
    SET balance = ?, updated_at = ?
    WHERE id = ?
  `);

  const insertLedger = db.prepare(`
    INSERT INTO credit_ledger (id, member_id, delta, balance_after, reason, transaction_id, note, item_breakdown_json, stock_event_ids_json, created_at)
    VALUES (@id, @memberId, @delta, @balanceAfter, @reason, @transactionId, @note, @itemBreakdownJson, @stockEventIdsJson, @createdAt)
  `);

  const listLedger = db.prepare(`
    SELECT id, member_id, delta, balance_after, reason, transaction_id, note, item_breakdown_json, stock_event_ids_json, created_at
    FROM credit_ledger
    ORDER BY created_at DESC
    LIMIT 500
  `);

  const listLedgerByMember = db.prepare(`
    SELECT id, member_id, delta, balance_after, reason, transaction_id, note, item_breakdown_json, stock_event_ids_json, created_at
    FROM credit_ledger
    WHERE member_id = ?
    ORDER BY created_at DESC
    LIMIT 500
  `);

  const mapMember = (row: {
    id: string;
    display_name: string;
    active: number;
    balance: number;
    created_at: string;
    updated_at: string;
  }): Member => ({
    id: row.id,
    displayName: row.display_name,
    active: Boolean(row.active),
    balance: Number(row.balance.toFixed(2)),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  });

  const mapLedger = (row: {
    id: string;
    member_id: string;
    delta: number;
    balance_after: number;
    reason: CreditLedgerReason;
    transaction_id?: string | null;
    note?: string | null;
    item_breakdown_json?: string | null;
    stock_event_ids_json?: string | null;
    created_at: string;
  }): CreditLedgerEntry => ({
    id: row.id,
    memberId: row.member_id,
    delta: Number(row.delta.toFixed(2)),
    balanceAfter: Number(row.balance_after.toFixed(2)),
    reason: row.reason,
    transactionId: row.transaction_id ?? undefined,
    note: row.note ?? undefined,
    itemBreakdown: row.item_breakdown_json
      ? (JSON.parse(row.item_breakdown_json) as CreditItemBreakdown[])
      : undefined,
    stockEventIds: row.stock_event_ids_json
      ? (JSON.parse(row.stock_event_ids_json) as string[])
      : undefined,
    createdAt: row.created_at
  });

  const adjustBalanceTx = db.transaction(
    (input: {
      eventId?: string;
      memberId: string;
      delta: number;
      reason: CreditLedgerReason;
      note?: string;
      transactionId?: string;
      itemBreakdown?: CreditItemBreakdown[];
      stockEventIds?: string[];
      preventNegative?: boolean;
    }) => {
      const existing = selectMemberForUpdate.get(input.memberId) as
        | {
            id: string;
            display_name: string;
            active: number;
            balance: number;
            created_at: string;
            updated_at: string;
          }
        | undefined;

      if (!existing) {
        throw new Error("MEMBER_NOT_FOUND");
      }

      const nextBalance = Number((existing.balance + input.delta).toFixed(2));
      if (input.preventNegative && nextBalance < 0) {
        throw new Error("INSUFFICIENT_CREDIT");
      }

      const updatedAt = new Date().toISOString();
      updateMemberBalance.run(nextBalance, updatedAt, input.memberId);

      const entryId = input.eventId ?? randomBytes(8).toString("hex");
      const createdAt = new Date().toISOString();
      insertLedger.run({
        id: entryId,
        memberId: input.memberId,
        delta: Number(input.delta.toFixed(2)),
        balanceAfter: nextBalance,
        reason: input.reason,
        transactionId: input.transactionId ?? null,
        note: input.note?.trim() || null,
        itemBreakdownJson: input.itemBreakdown ? JSON.stringify(input.itemBreakdown) : null,
        stockEventIdsJson: input.stockEventIds ? JSON.stringify(input.stockEventIds) : null,
        createdAt
      });

      const next = selectMemberById.get(input.memberId) as {
        id: string;
        display_name: string;
        active: number;
        balance: number;
        created_at: string;
        updated_at: string;
      };

      const entryRow = {
        id: entryId,
        member_id: input.memberId,
        delta: Number(input.delta.toFixed(2)),
        balance_after: nextBalance,
        reason: input.reason,
        transaction_id: input.transactionId ?? null,
        note: input.note?.trim() || null,
        item_breakdown_json: input.itemBreakdown ? JSON.stringify(input.itemBreakdown) : null,
        stock_event_ids_json: input.stockEventIds ? JSON.stringify(input.stockEventIds) : null,
        created_at: createdAt
      };

      return {
        member: mapMember(next),
        entry: mapLedger(entryRow)
      };
    }
  );

  return {
    async listMembers() {
      const rows = listMembers.all() as {
        id: string;
        display_name: string;
        active: number;
        balance: number;
        created_at: string;
        updated_at: string;
      }[];
      return rows.map(mapMember);
    },
    async getById(id) {
      const row = selectMemberById.get(id) as
        | {
            id: string;
            display_name: string;
            active: number;
            balance: number;
            created_at: string;
            updated_at: string;
          }
        | undefined;
      return row ? mapMember(row) : null;
    },
    async authenticateByPin(pin) {
      const rows = selectMemberByPin.all() as {
        id: string;
        display_name: string;
        pin_hash: string;
        active: number;
        balance: number;
        created_at: string;
        updated_at: string;
      }[];

      const row = rows.find((entry) => verifyPin(pin, entry.pin_hash));
      if (!row) {
        return null;
      }

      return mapMember(row);
    },
    async createMember(displayName, pin) {
      const now = new Date().toISOString();
      const id = randomBytes(8).toString("hex");
      insertMember.run({
        id,
        displayName: displayName.trim(),
        pinHash: hashPin(pin),
        active: 1,
        balance: 0,
        createdAt: now,
        updatedAt: now
      });

      const created = selectMemberById.get(id) as {
        id: string;
        display_name: string;
        active: number;
        balance: number;
        created_at: string;
        updated_at: string;
      };
      return mapMember(created);
    },
    async setMemberPin(memberId, pin) {
      updateMemberPin.run(hashPin(pin), new Date().toISOString(), memberId);
      return this.getById(memberId);
    },
    async setMemberActive(memberId, active) {
      updateMemberActive.run(active ? 1 : 0, new Date().toISOString(), memberId);
      return this.getById(memberId);
    },
    async adjustBalance(input) {
      return adjustBalanceTx(input);
    },
    async listLedger(memberId) {
      const rows = (memberId
        ? listLedgerByMember.all(memberId)
        : listLedger.all()) as {
        id: string;
        member_id: string;
        delta: number;
        balance_after: number;
        reason: CreditLedgerReason;
        transaction_id?: string | null;
        note?: string | null;
        item_breakdown_json?: string | null;
        stock_event_ids_json?: string | null;
        created_at: string;
      }[];

      return rows.map(mapLedger);
    }
  };
}
