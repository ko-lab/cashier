import { createServer, type IncomingMessage } from "node:http";
import { fileURLToPath } from "node:url";
import { implement } from "@orpc/server";
import { RPCHandler } from "@orpc/server/node";
import { contract } from "../../../shared/contract.ts";
import { createProductStore } from "./productStore.ts";
import { createTransactionStore } from "./transactionStore.ts";
import { createTransactionService } from "./transactionService.ts";
import { createAdminService } from "./adminService.ts";
import { createStockEventStore } from "./stockEventStore.ts";
import { createMemberStore } from "./memberStore.ts";
import { runWithRequestContext } from "./requestContext.ts";

const api = implement(contract);
const defaultDataDir = fileURLToPath(new URL("../data/", import.meta.url));
const defaultCatalogDir = fileURLToPath(new URL("../catalog/", import.meta.url));
const dataDir = process.env.DATA_DIR ?? defaultDataDir;
const catalogDir = process.env.CATALOG_DIR ?? defaultCatalogDir;
const stockEventStore = createStockEventStore(dataDir);
const productStore = createProductStore(catalogDir, stockEventStore);
const transactionStore = createTransactionStore(dataDir);
const memberStore = createMemberStore(dataDir);
const transactionService = createTransactionService(
  productStore,
  transactionStore,
  stockEventStore,
  memberStore
);
const adminService = createAdminService({
  transactionStore,
  productStore,
  stockEventStore,
  memberStore,
  adminPanelPassword: process.env.ADMIN_PANEL_PASSWORD
});

const router = {
  product: {
    list: api.product.list.handler(async () => productStore.listCatalog())
  },
  member: {
    authPin: api.member.authPin.handler(async ({ input }) => ({
      member: await adminService.authenticateMemberByPin(input.pin)
    })),
    list: api.member.list.handler(async () => adminService.listActiveMembersPublic())
  },
  transaction: {
    start: api.transaction.start.handler(async ({ input }) =>
      transactionService.startTransaction(input.items, {
        memberId: input.memberId,
        creditToUse: input.creditToUse
      })
    ),
    startTopup: api.transaction.startTopup.handler(async ({ input }) =>
      transactionService.startTopupTransaction(input.memberId, input.amount)
    ),
    finalize: api.transaction.finalize.handler(async ({ input }) =>
      transactionService.finalizeTransaction(input.id, input.status, {
        reason: input.reason,
        memberId: input.memberId,
        creditUsed: input.creditUsed
      })
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
        active: input.active,
        note: input.note,
        action: input.action
      })
    ),
    listMembers: api.admin.listMembers.handler(async ({ input }) =>
      adminService.listMembers(input.password)
    ),
    listCustomers: api.admin.listCustomers.handler(async ({ input }) =>
      adminService.listMembers(input.password)
    ),
    createMember: api.admin.createMember.handler(async ({ input }) =>
      adminService.createMember(input.password, input.displayName, input.pin, input.customerType)
    ),
    createCustomer: api.admin.createCustomer.handler(async ({ input }) =>
      adminService.createMember(input.password, input.displayName, input.pin, input.customerType)
    ),
    setMemberPin: api.admin.setMemberPin.handler(async ({ input }) =>
      adminService.setMemberPin(input.password, input.memberId, input.pin)
    ),
    setCustomerPin: api.admin.setCustomerPin.handler(async ({ input }) =>
      adminService.setMemberPin(input.password, input.memberId, input.pin)
    ),
    setMemberActive: api.admin.setMemberActive.handler(async ({ input }) =>
      adminService.setMemberActive(input.password, input.memberId, input.active)
    ),
    setCustomerActive: api.admin.setCustomerActive.handler(async ({ input }) =>
      adminService.setMemberActive(input.password, input.memberId, input.active)
    ),
    topupCredit: api.admin.topupCredit.handler(async ({ input }) =>
      adminService.topupCredit(input.password, input.memberId, input.amount, input.note)
    ),
    creditLedger: api.admin.creditLedger.handler(async ({ input }) =>
      adminService.creditLedger(input.password, input.memberId)
    )
  }
};

const rpcHandler = new RPCHandler(router);
const rpcPrefix = "/rpc";
const clientLogPath = "/client-log";
const healthPath = "/healthz";
const port = Number(process.env.PORT ?? 4000);

const firstHeaderValue = (value: string | string[] | undefined): string | undefined => {
  if (!value) {
    return undefined;
  }
  return Array.isArray(value) ? value[0] : value;
};

const getRequestIpAddress = (req: IncomingMessage): string => {
  const forwardedFor = firstHeaderValue(req.headers["x-forwarded-for"]);
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  const realIp = firstHeaderValue(req.headers["x-real-ip"]);
  if (realIp?.trim()) {
    return realIp.trim();
  }

  const cloudflareIp = firstHeaderValue(req.headers["cf-connecting-ip"]);
  if (cloudflareIp?.trim()) {
    return cloudflareIp.trim();
  }

  return req.socket.remoteAddress ?? "unknown";
};

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

  const requestIpAddress = getRequestIpAddress(req);
  const result = await runWithRequestContext({ ipAddress: requestIpAddress }, () =>
    rpcHandler.handle(req, res)
  );

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
