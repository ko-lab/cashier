import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { ContractRouterClient } from "@orpc/contract";
import { contract } from "@shared/contract";

function resolveApiUrl(): string {
  const configured = import.meta.env.VITE_API_URL;
  if (configured) {
    if (configured.startsWith("http://") || configured.startsWith("https://")) {
      return configured;
    }
    if (configured.startsWith("/") && typeof window !== "undefined") {
      return `${window.location.origin}${configured}`;
    }
    return configured;
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
