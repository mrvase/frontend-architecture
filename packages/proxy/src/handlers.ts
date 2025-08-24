import { defaultCache, type ProxyRequestCache } from "./cache";
import type { ProxyRequest, RequestArgument, RequestValue } from "./request";

export const ProxySymbol: {
  readonly internal: unique symbol;
  readonly cache: unique symbol;
  readonly onInject: unique symbol;
  readonly unwrap: unique symbol;
} = {
  internal: Symbol("internal") as typeof ProxySymbol.internal,
  cache: Symbol("cache") as typeof ProxySymbol.cache,
  onInject: Symbol("onInject") as typeof ProxySymbol.onInject,
  unwrap: Symbol("unwrap") as typeof ProxySymbol.unwrap,
};

export type HandlerFn<
  T extends RequestValue = RequestValue,
  TArg extends RequestArgument = RequestArgument
> = (...args: TArg[]) => T;

export type RequestFn<T extends RequestValue = RequestValue> = (request: ProxyRequest) => T;

type Nested<T> = T | Nested<T>[];

export type InjectableRecord = {
  [key: string]: unknown;
} & {
  [ProxySymbol.internal]?: InjectableRecord;
};

export type HandlerRecord = {
  [key: string]: HandlerNode;
} & {
  [ProxySymbol.internal]?: Nested<HandlerNode | InjectableRecord>;
  [ProxySymbol.cache]?: ProxyRequestCache;
  [ProxySymbol.onInject]?: (payload: unknown) => unknown;
  [ProxySymbol.unwrap]?: (request: ProxyRequest) => unknown;
};

export type HandlerNode = Nested<HandlerFn<any, any>> | Nested<HandlerRecord | RequestFn<any>>;

const isOrdinaryFunction = (fn: unknown): fn is Function => {
  return typeof fn === "function" && !(fn as any)[ProxySymbol.onInject];
};

const isHandlerRecord = (record: unknown): record is HandlerRecord => {
  return typeof record === "object" && record !== null && !Array.isArray(record);
};

export const getHandlers = <T extends RequestValue>(
  request: ProxyRequest<T>,
  handlers: HandlerNode,
  privateScope?: boolean
): {
  fn: HandlerFn<T>;
  cache: ProxyRequestCache;
}[] => {
  const fns: {
    fn: HandlerFn<T>;
    cache: ProxyRequestCache;
  }[] = [];

  const getFromHandlers = (
    handlers: HandlerNode,
    restPath: string[],
    cache: ProxyRequestCache,
    parent?: HandlerRecord
  ) => {
    if (isOrdinaryFunction(handlers)) {
      const fn = handlers.bind(parent);
      if (restPath.length === 0) {
        fns.push({
          fn: fn as HandlerFn<T>,
          cache,
        });
      } else {
        // topic listener
        fns.push({
          fn: () => (fn as RequestFn<T>)(request),
          cache,
        });
      }
      return;
    }

    if (Array.isArray(handlers)) {
      handlers.forEach((handler) => getFromHandlers(handler, restPath, cache, parent));
      return;
    }

    const callback = handlers[ProxySymbol.unwrap];
    if (callback) {
      fns.push({
        fn: () => callback({ ...request, type: restPath }) as T,
        cache,
      });
      return;
    }

    if (isHandlerRecord(handlers)) {
      const nextCache = handlers[ProxySymbol.cache] ?? cache;

      if (handlers[ProxySymbol.internal] && privateScope) {
        getFromHandlers(
          handlers[ProxySymbol.internal] as HandlerNode,
          restPath,
          nextCache,
          handlers
        );
      }

      const [first, ...rest] = restPath;
      const next = handlers[first];

      if (!next) {
        return;
      }

      getFromHandlers(next, rest, nextCache, handlers);
    }
  };

  getFromHandlers(handlers, request.type, defaultCache);

  return fns;
};

export const getFirstHandler = <T>(
  path: string[],
  handlers: HandlerNode
): {
  result: unknown | undefined;
  cache: ProxyRequestCache;
} => {
  const getFromHandlers = (
    handlers: HandlerNode,
    restPath: string[],
    cache: ProxyRequestCache,
    parent?: HandlerRecord
  ): {
    result: unknown | undefined;
    cache: ProxyRequestCache;
  } => {
    if (restPath.length === 0) {
      return { result: handlers, cache };
    }

    if (Array.isArray(handlers)) {
      for (const handler of handlers) {
        const result = getFromHandlers(handler, restPath, cache, parent);
        if (result.result) {
          return result;
        }
      }
    }

    if (isHandlerRecord(handlers)) {
      const nextCache = handlers[ProxySymbol.cache] ?? cache;

      if (handlers[ProxySymbol.internal]) {
        const result = getFromHandlers(
          handlers[ProxySymbol.internal] as HandlerNode,
          restPath,
          nextCache,
          handlers
        );
        if (result.result !== undefined) {
          return result;
        }
      }

      const [first, ...rest] = restPath;
      const next = handlers[first];

      if (next === undefined) {
        return {
          result: undefined,
          cache: nextCache,
        };
      }

      const result = getFromHandlers(next, rest, nextCache, handlers);

      return result;
    }

    return {
      result: undefined,
      cache,
    };
  };

  return getFromHandlers(handlers, path, defaultCache);
};
