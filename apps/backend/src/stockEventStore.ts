import path from "node:path";
import { randomUUID } from "node:crypto";
import { readJson, writeJson } from "./storage.ts";
import type { StockEvent } from "../../../shared/models.ts";

type CreateStockEventInput = {
  productId: string;
  type: StockEvent["type"];
  quantity: number;
  note?: string;
  transactionId?: string;
  memberCreditEventId?: string;
};

export type StockEventStore = {
  listEvents: () => Promise<StockEvent[]>;
  appendEvent: (input: CreateStockEventInput) => Promise<StockEvent>;
  getCurrentQuantities: () => Promise<Map<string, { quantity: number; updatedAt?: string }>>;
};

function applyEvent(current: number, event: StockEvent): number {
  if (event.type === "manual_set") {
    return event.quantity;
  }
  if (event.type === "refill_delta" || event.type === "sale_delta") {
    return current + event.quantity;
  }
  if (event.type === "comment" || event.type === "counted_ok") {
    return current;
  }
  return current;
}

export function createStockEventStore(dataDir: string): StockEventStore {
  const eventsPath = path.join(dataDir, "stock-events.json");

  return {
    async listEvents() {
      const events = await readJson<StockEvent[]>(eventsPath, []);
      return events.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },
    async appendEvent(input) {
      const events = await this.listEvents();
      const event: StockEvent = {
        id: randomUUID(),
        productId: input.productId,
        type: input.type,
        quantity: Math.trunc(input.quantity),
        createdAt: new Date().toISOString(),
        note: input.note,
        transactionId: input.transactionId,
        memberCreditEventId: input.memberCreditEventId
      };
      events.push(event);
      await writeJson(eventsPath, events);
      return event;
    },
    async getCurrentQuantities() {
      const events = await this.listEvents();
      const quantities = new Map<string, { quantity: number; updatedAt?: string }>();

      for (const event of events) {
        const current = quantities.get(event.productId)?.quantity ?? 0;
        const next = applyEvent(current, event);
        quantities.set(event.productId, {
          quantity: next,
          updatedAt: event.createdAt
        });
      }

      return quantities;
    }
  };
}
