export { Cache } from "./types";
export type {
  JsonValue,
  HandlerStore,
  InterceptorStore,
  ProxyRequest,
  ProxyRequestCache,
  HandlerFn,
  InterceptorFn,
  RequestFn,
  RequestValue,
} from "./types";

export {
  createProxyRequest,
  inject,
  getRequestType,
  proxy,
  type ProxyClient,
  type Proxy,
  type Inject,
} from "./proxy";

export {
  createHandlerStore,
  createInterceptorStore,
  globalHandlers,
  globalInterceptors,
} from "./handlers";

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

export const { query, mutate, dispatch, redispatch, invalidate, cache } = globalInvokers;

export { noCache } from "./options";

export type Query = Invokers["query"];
export type Mutate = Invokers["mutate"];
export type Dispatch = Invokers["dispatch"];
export type Invalidate = Invokers["invalidate"];

export { defaultCache } from "./cache";

import type { HandlerFn, RETURN_TYPE } from "./types";

export type HandlerRecord = {
  [Prefix: string | symbol]: { [Key: string | symbol]: HandlerFn };
};

export type Handlers<T extends HandlerRecord> = {
  [Prefix in keyof T]?: {
    [Key in keyof T[Prefix]]?: (
      ...input: Parameters<T[Prefix][Key]>
    ) => ReturnType<T[Prefix][Key]> extends (arg: any) => any ? void : ReturnType<T[Prefix][Key]>;
  };
};

export type QueryInterceptors<T extends HandlerRecord> = {
  [Prefix in keyof T]?: {
    [Key in keyof T[Prefix]]?: (
      value: ReturnType<T[Prefix][Key]>,
      ...args: Parameters<T[Prefix][Key]>
    ) => ReturnType<T[Prefix][Key]>;
  };
};

export type CommandInterceptors<T extends HandlerRecord> = {
  [Prefix in keyof T]?: {
    [Key in keyof T[Prefix]]?: (
      ...args: Parameters<T[Prefix][Key]>
    ) => Parameters<T[Prefix][Key]>[0];
  };
};

export type RecursiveHandlerRecord = { [Key: string | symbol]: RecursiveHandlerRecord | HandlerFn };

export type InferProxyRequest<
  T extends RecursiveHandlerRecord,
  TPrefix extends (string | symbol)[] = [],
> = {
  [Key in keyof T]: T[Key] extends RecursiveHandlerRecord
    ? Key extends string | symbol
      ? InferProxyRequest<T[Key], [...TPrefix, Key]>
      : never
    : T[Key] extends HandlerFn
      ? {
          type: [...TPrefix, Key];
          payload: Parameters<T[Key]>;
          [RETURN_TYPE]: ReturnType<T[Key]>;
        }
      : never;
}[keyof T];

export const memo = <T extends (...args: any) => any>(
  fn: T,
  equals: (a: ReturnType<T>, b: ReturnType<T>) => boolean
): T => {
  return fn;
};
