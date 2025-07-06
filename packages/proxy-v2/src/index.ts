export type { JsonValue, ProxyRequest, RequestValue } from "./request";

export type { ProxyRequestCache } from "./cache";

export { ProxySymbol, type HandlerFn, type RequestFn } from "./handlers";

export {
  createProxyRequest,
  inject,
  getRequestType,
  proxy,
  type ToProxy,
  type Proxy,
  type Inject,
} from "./proxy";

export {
  createInvokers,
  globalInvokers,
  registerRequestLogListener,
  type Invokers,
  type RequestLog,
} from "./invokers";

export { transaction } from "./transaction";

import { globalInvokers, type Invokers } from "./invokers";
import { proxy } from "./proxy";

export const handlers = proxy();

export const { query, mutate, dispatch, redispatch, invalidate, cache } =
  globalInvokers;

export { noCache } from "./options";

export type Query = Invokers["query"];
export type Mutate = Invokers["mutate"];
export type Dispatch = Invokers["dispatch"];
export type Invalidate = Invokers["invalidate"];

export { defaultCache } from "./cache";
