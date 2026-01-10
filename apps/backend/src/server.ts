import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { implement } from "@orpc/server";
import { RPCHandler } from "@orpc/server/node";
import { contract } from "../../../shared/contract";
import { createProductStore } from "./productStore";
import { createTransactionStore } from "./transactionStore";
import { createTransactionService } from "./transactionService";

const api = implement(contract);
const defaultDataDir = fileURLToPath(new URL("../data/", import.meta.url));
const dataDir = process.env.DATA_DIR ?? defaultDataDir;
const productStore = createProductStore(dataDir);
const transactionStore = createTransactionStore(dataDir);
const transactionService = createTransactionService(productStore, transactionStore);

const router = {
  product: {
    list: api.product.list.handler(async () => productStore.listProducts())
  },
  transaction: {
    start: api.transaction.start.handler(async ({ input }) =>
      transactionService.startTransaction(input.items)
    ),
    finalize: api.transaction.finalize.handler(async ({ input }) =>
      transactionService.finalizeTransaction(input.id, input.status)
    )
  }
};

const rpcHandler = new RPCHandler(router);
const rpcPrefix = "/rpc";
const port = Number(process.env.PORT ?? 4000);

const server = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (!req.url || !req.url.startsWith(rpcPrefix)) {
    res.statusCode = 404;
    res.end("Not found");
    return;
  }

  req.url = req.url.slice(rpcPrefix.length) || "/";
  const result = await rpcHandler.handle(req, res);

  if (!result.matched) {
    res.statusCode = 404;
    res.end("Not found");
  }
});

server.listen(port, () => {
  console.log(`oRPC server listening on http://localhost:${port}${rpcPrefix}`);
});
