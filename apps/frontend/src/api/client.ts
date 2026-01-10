import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { ContractRouterClient } from "@orpc/contract";
import { contract } from "@shared/contract";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:4000/rpc";

const link = new RPCLink({
  url: apiUrl
});

export const client: ContractRouterClient<typeof contract> = createORPCClient(link);
