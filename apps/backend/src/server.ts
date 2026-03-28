import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { implement } from "@orpc/server";
import { RPCHandler } from "@orpc/server/node";
import { contract } from "../../../shared/contract.ts";
import { createProductStore } from "./productStore.ts";
import { createTransactionStore } from "./transactionStore.ts";
import { createTransactionService } from "./transactionService.ts";
import { createAdminService } from "./adminService.ts";
import { createStockEventStore } from "./stockEventStore.ts";

const api = implement(contract);
const defaultDataDir = fileURLToPath(new URL("../data/", import.meta.url));
const defaultCatalogDir = fileURLToPath(new URL("../catalog/", import.meta.url));
const dataDir = process.env.DATA_DIR ?? defaultDataDir;
const catalogDir = process.env.CATALOG_DIR ?? defaultCatalogDir;
const stockEventStore = createStockEventStore(dataDir);
const productStore = createProductStore(catalogDir, stockEventStore);
const transactionStore = createTransactionStore(dataDir);
const transactionService = createTransactionService(
  productStore,
  transactionStore,
  stockEventStore
);
const adminService = createAdminService({
  transactionStore,
  productStore,
  stockEventStore,
  adminPanelPassword: process.env.ADMIN_PANEL_PASSWORD
});

const router = {
  product: {
    list: api.product.list.handler(async () => productStore.listCatalog())
  },
  transaction: {
    start: api.transaction.start.handler(async ({ input }) =>
      transactionService.startTransaction(input.items)
    ),
    finalize: api.transaction.finalize.handler(async ({ input }) =>
      transactionService.finalizeTransaction(input.id, input.status, input.reason)
    )
  },
  admin: {
    exportTransactions: api.admin.exportTransactions.handler(async ({ input }) =>
      adminService.exportTransactions(input.password)
    ),
    getStock: api.admin.getStock.handler(async ({ input }) =>
      adminService.getStock(input.password)
    ),
    setStock: api.admin.setStock.handler(async ({ input }) =>
      adminService.setStock(input.password, {
        productId: input.productId,
        quantity: input.quantity,
        note: input.note,
        action: input.action
      })
    )
  }
};

const rpcHandler = new RPCHandler(router);
const rpcPrefix = "/rpc";
const clientLogPath = "/client-log";
const healthPath = "/healthz";
const port = Number(process.env.PORT ?? 4000);

const server = createServer(async (req, res) => {
  try {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.url === healthPath && req.method === "GET") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: true, ts: new Date().toISOString() }));
    return;
  }

  if (req.url?.startsWith(clientLogPath) && req.method === "GET") {
    const requestUrl = new URL(req.url, "http://localhost");
    const payload = {
      title: requestUrl.searchParams.get("title"),
      message: requestUrl.searchParams.get("message"),
      href: requestUrl.searchParams.get("href"),
      ua: requestUrl.searchParams.get("ua"),
      ts: requestUrl.searchParams.get("ts")
    };
    console.log(`[client-log] ${new Date().toISOString()} ${JSON.stringify(payload)}`);
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.url === clientLogPath && req.method === "POST") {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");
      console.log(`[client-log] ${new Date().toISOString()} ${body}`);
      res.statusCode = 204;
      res.end();
    });
    return;
  }

  if (!req.url) {
    res.statusCode = 404;
    res.end("Not found");
    return;
  }

  // Support both routing styles:
  // 1) external /rpc path forwarded as-is
  // 2) reverse-proxy path stripping (/rpc -> /)
  if (req.url.startsWith(rpcPrefix)) {
    req.url = req.url.slice(rpcPrefix.length) || "/";
  }

  const result = await rpcHandler.handle(req, res);

  if (!result.matched) {
    res.statusCode = 404;
    res.end("Not found");
  }
  } catch (error) {
    console.error(
      `[server-error] ${new Date().toISOString()} ${req.method ?? "UNKNOWN"} ${req.url ?? ""}`,
      error
    );
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Internal Server Error" }));
    } else {
      res.end();
    }
  }
});

process.on("unhandledRejection", (reason) => {
  console.error(`[unhandledRejection] ${new Date().toISOString()}`, reason);
});

process.on("uncaughtException", (error) => {
  console.error(`[uncaughtException] ${new Date().toISOString()}`, error);
});

server.listen(port, () => {
  console.log(`oRPC server listening on http://localhost:${port}${rpcPrefix}`);
});
