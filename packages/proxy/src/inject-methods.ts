import { ProxySymbol } from "./handlers";
import { inject as injectFn, proxy as proxyFn } from "./proxy";

export const requests = proxyFn();
// export const queries = proxyFn();
// export const commands = proxyFn();

export { proxy } from "./proxy";
export { inject } from "./proxy";

export const injectables = injectFn();

export {
  createInvokers,
  query,
  mutate,
  dispatch,
  redispatch,
  invalidate,
  setCache,
} from "./invokers";
export { transaction } from "./transaction";
export { createProxyRequest } from "./proxy";

export const internal: typeof ProxySymbol.internal = ProxySymbol.internal;
export const cache: typeof ProxySymbol.cache = ProxySymbol.cache;
export const onInject: typeof ProxySymbol.onInject = ProxySymbol.onInject;
export const unwrap: typeof ProxySymbol.unwrap = ProxySymbol.unwrap;

export { noCache } from "./options";

export type { JsonValue, ProxyRequest, RequestValue, ProxyEvent, RequestArgument } from "./request";

export type {
  HandlerFn,
  RequestFn,
  HandlerNode,
  HandlerRecord,
  InjectableRecord,
} from "./handlers";

export type { InferHandlers, InferInjectables, ToProxy, Handlers, Injectables } from "./proxy";

export type { Invokers, Query, Mutate, Dispatch, Invalidate } from "./invokers";
