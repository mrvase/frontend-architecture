export type { JsonValue, ProxyRequest, RequestValue } from "./request";

export type { ProxyRequestCache } from "./cache";

export {
  ProxySymbol,
  type HandlerFn,
  type RequestFn,
  type HandlerNode,
  type HandlerRecord,
  type InjectableRecord,
} from "./handlers";

export {
  createProxyRequest,
  inject,
  getRequestType,
  proxy,
  type InferHandlers,
  type InferInjectables,
  type ToProxy,
  type Handlers,
  type Injectables,
} from "./proxy";

export {
  createInvokers,
  globalInvokers,
  registerRequestLogListener,
  type Invokers,
  type RequestLog,
} from "./invokers";

export { transaction } from "./transaction";

import { ProxySymbol } from "./handlers";
import { createInvokers, globalInvokers, type Invokers } from "./invokers";
import { inject, proxy } from "./proxy";

export const { query, mutate, dispatch, redispatch, invalidate, cache } =
  globalInvokers;

export { noCache } from "./options";

export type Query = Invokers["query"];
export type Mutate = Invokers["mutate"];
export type Dispatch = Invokers["dispatch"];
export type Invalidate = Invokers["invalidate"];

export { defaultCache } from "./cache";

export const Inject = Object.assign(
  inject,
  {
    proxy,
    query,
    mutate,
    dispatch,
    invalidate,
    createInvokers,
    // cache,
  },
  ProxySymbol
);
