import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { ContractRouterClient } from "@orpc/contract";
import { contract } from "@shared/contract";

function resolveApiUrl(): string {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/rpc`;
  }
  return "http://localhost:4000/rpc";
}

const apiUrl = resolveApiUrl();

const link = new RPCLink({
  url: apiUrl
});

export const client: ContractRouterClient<typeof contract> = createORPCClient(link);
