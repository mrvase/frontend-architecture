/* JSON */

import type { InjectProxyPayload, ProxyCallback, ProxyPayload } from "./proxy";

/* json types from type-fest */
type JsonObject = { [Key in string]: JsonValue } & {
  [Key in string]?: JsonValue | undefined;
};
type JsonArray = JsonValue[] | readonly JsonValue[];
type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;

export type MaybePromise<T> = T | Promise<T>;

export type RequestValue = MaybePromise<JsonValue | void>;
/* */

export type RequestType = "query" | "mutate" | "dispatch";

export type HandlerFn<T = any> = (...args: any[]) => T;
export type InterceptorFn = <T = any>(arg: T, ...args: any[]) => T;
export type RequestFn<T = any> = (request: ProxyRequest) => T;

export type HandlerStore = {
  register: (...records: HandlerRecord[]) => () => void;
  registerPublic: (...records: HandlerRecord[]) => () => void;
  registerPrivate: (...records: HandlerRecord[]) => () => void;
  registerPrivateGlobal: (...records: HandlerRecord[]) => () => void;
  get: <T>(
    request: ProxyRequest<T>,
    privateScope?: boolean
  ) => (HandlerFn<T> & { [Cache]?: ProxyRequestCache })[];
  // first is always private scope
  first: (request: (string | symbol)[]) => HandlerAccumulator | undefined;
  listPublic: () => Set<Set<HandlerRecord>>;
  listPrivate: () => Set<Set<HandlerRecord>>;
};

export type InterceptorStore = {
  register: (...records: HandlerRecord[]) => () => void;
  get: <T>(request: ProxyRequest<T>) => InterceptorFn[];
  list: () => Set<Set<HandlerRecord>>;
};

export const Cache = Symbol("Cache");

export type HandlerRecord = {
  [key: string | symbol]: unknown;
  [Cache]?: ProxyRequestCache;
};

export type HandlerAccumulator = (
  | {
      [key: string | symbol]: HandlerAccumulator;
    }
  | ((...args: unknown[]) => unknown)
) & {
  // the handlers might already by a proxy, which allows for these properties
  [ProxyCallback]?: RequestFn;
  [InjectProxyPayload]?: (payload: ProxyPayload) => HandlerAccumulator;
};

export declare const RETURN_TYPE: unique symbol;

export type ProxyRequest<T = unknown> = {
  type: (string | symbol)[];
  payload: unknown[];
  [RETURN_TYPE]: T;
};

export type ProxyEvent<T extends Record<string, unknown>> = {
  type: [T["type"]];
  payload: [Omit<T, "type">];
  [RETURN_TYPE]: void;
};

export type ProxyRequestCache<TCachedValue = unknown> = {
  query: <T>(request: ProxyRequest<T>, invoke: () => T) => T;
  mutate: <T>(request: ProxyRequest<T>, invoke: () => T) => T;
  dispatch: <T>(request: ProxyRequest<T>, invoke: () => T[]) => Promise<void>;
  invalidate: (type: (string | symbol)[] | ProxyRequest) => void;
  set: <T>(request: ProxyRequest<T>, value: T) => void;
  getCachedData?: (request: ProxyRequest) => TCachedValue | undefined;
};
