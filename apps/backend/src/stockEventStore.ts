import path from "node:path";
import { randomUUID } from "node:crypto";
import { readJson, writeJson } from "./storage.ts";
import type { StockEvent } from "../../../shared/models.ts";

type CreateStockEventInput = {
  productId: string;
  type: StockEvent["type"];
  quantity: number;
  active?: boolean;
  note?: string;
  transactionId?: string;
  memberCreditEventId?: string;
};

type StockState = {
  quantity: number;
  active: boolean;
  updatedAt?: string;
};

export type StockEventStore = {
  listEvents: () => Promise<StockEvent[]>;
  appendEvent: (input: CreateStockEventInput) => Promise<StockEvent>;
  getCurrentStates: () => Promise<Map<string, StockState>>;
  getCurrentQuantities: () => Promise<Map<string, { quantity: number; updatedAt?: string }>>;
};

function applyEvent(current: StockState, event: StockEvent): StockState {
  if (event.type === "manual_set") {
    return { ...current, quantity: event.quantity };
  }
  if (event.type === "refill_delta" || event.type === "sale_delta") {
    return { ...current, quantity: current.quantity + event.quantity };
  }
  if (event.type === "active_set") {
    return { ...current, active: event.active ?? current.active };
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
        active: input.active,
        createdAt: new Date().toISOString(),
        note: input.note,
        transactionId: input.transactionId,
        memberCreditEventId: input.memberCreditEventId
      };
      events.push(event);
      await writeJson(eventsPath, events);
      return event;
    },
    async getCurrentStates() {
      const events = await this.listEvents();
      const states = new Map<string, StockState>();

      for (const event of events) {
        const current =
          states.get(event.productId) ?? {
            quantity: 0,
            active: true
          };
        const next = applyEvent(current, event);
        states.set(event.productId, {
          ...next,
          updatedAt: event.createdAt
        });
      }

      return states;
    },
    async getCurrentQuantities() {
      const states = await this.getCurrentStates();
      const quantities = new Map<string, { quantity: number; updatedAt?: string }>();

      for (const [productId, state] of states.entries()) {
        quantities.set(productId, {
          quantity: state.quantity,
          updatedAt: state.updatedAt
        });
      }

      return quantities;
    }
  };
}
