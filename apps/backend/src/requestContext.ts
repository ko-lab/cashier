import { AsyncLocalStorage } from "node:async_hooks";

type RequestContext = {
  ipAddress?: string;
};

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(
  context: RequestContext,
  callback: () => Promise<T>
): Promise<T> {
  return storage.run(context, callback);
}

export function getRequestContext(): RequestContext {
  return storage.getStore() ?? {};
}
