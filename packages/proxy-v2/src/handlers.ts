import { defaultCache, type ProxyRequestCache } from "./cache";
import type { ProxyRequest } from "./request";

export const ProxySymbol: {
  readonly private: unique symbol;
  readonly cache: unique symbol;
  readonly onInject: unique symbol;
  readonly unwrap: unique symbol;
} = {
  private: Symbol("private") as typeof ProxySymbol.private,
  cache: Symbol("cache") as typeof ProxySymbol.cache,
  onInject: Symbol("onInject") as typeof ProxySymbol.onInject,
  unwrap: Symbol("unwrap") as typeof ProxySymbol.unwrap,
};

export type HandlerFn<T = any> = (...args: any[]) => T;
export type RequestFn<T = any> = (request: ProxyRequest) => T;

type Nested<T> = T | Nested<T>[];

export type InjectableRecord = {
  [key: string]: unknown;
} & {
  [ProxySymbol.private]?: InjectableRecord;
};

export type HandlerRecord = {
  [key: string]: HandlerNode;
} & {
  [ProxySymbol.private]?: HandlerNode | InjectableRecord;
  [ProxySymbol.cache]?: ProxyRequestCache;
  [ProxySymbol.onInject]?: (payload: unknown) => unknown;
  [ProxySymbol.unwrap]?: (request: ProxyRequest) => unknown;
};

export type HandlerNode = Nested<HandlerFn> | Nested<HandlerRecord | RequestFn>;

const isOrdinaryFunction = (fn: unknown): fn is Function => {
  return typeof fn === "function" && !(fn as any)[ProxySymbol.onInject];
};

const isHandlerRecord = (record: unknown): record is HandlerRecord => {
  return (
    typeof record === "object" && record !== null && !Array.isArray(record)
  );
};

export const getHandlers = <T>(
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
    path: string[],
    cache: ProxyRequestCache,
    parent?: HandlerRecord
  ) => {
    if (isOrdinaryFunction(handlers)) {
      const fn = handlers.bind(parent);
      if (path.length === 0) {
        fns.push({
          fn,
          cache,
        });
      } else {
        // topic listener
        fns.push({
          fn: () => fn(request) as T,
          cache,
        });
      }
      return;
    }

    if (Array.isArray(handlers)) {
      handlers.forEach((handler) =>
        getFromHandlers(handler, path, cache, parent)
      );
      return;
    }

    const proxyCallback = handlers[ProxySymbol.unwrap];
    if (proxyCallback) {
      fns.push({
        fn: () => proxyCallback(request) as T,
        cache: handlers[ProxySymbol.cache] ?? cache,
      });
      return;
    }

    if (isHandlerRecord(handlers)) {
      if (handlers[ProxySymbol.private] && privateScope) {
        getFromHandlers(
          handlers[ProxySymbol.private] as HandlerNode,
          path,
          handlers[ProxySymbol.cache] ?? cache,
          handlers
        );
      }

      const [first, ...rest] = path;
      const next = handlers[first];

      if (!next) {
        return;
      }

      getFromHandlers(
        next,
        rest,
        handlers[ProxySymbol.cache] ?? cache,
        handlers
      );
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
    path: string[],
    cache: ProxyRequestCache,
    parent?: HandlerRecord
  ): {
    result: unknown | undefined;
    cache: ProxyRequestCache;
  } => {
    if (path.length === 0) {
      return { result: handlers, cache };
    }

    if (Array.isArray(handlers)) {
      for (const handler of handlers) {
        const result = getFromHandlers(handler, path, cache, parent);
        if (result.result) {
          return result;
        }
      }
      return {
        result: undefined,
        cache,
      };
    }

    if (isHandlerRecord(handlers)) {
      if (handlers[ProxySymbol.private]) {
        const result = getFromHandlers(
          handlers[ProxySymbol.private] as HandlerNode,
          path,
          handlers[ProxySymbol.cache] ?? cache,
          handlers
        );
        if (result.result !== undefined) {
          return result;
        }
      }

      const [first, ...rest] = path;
      const next = handlers[first];

      if (next === undefined) {
        return {
          result: undefined,
          cache,
        };
      }

      const result = getFromHandlers(
        next,
        rest,
        handlers[ProxySymbol.cache] ?? cache,
        handlers
      );

      return result;
    }

    return {
      result: undefined,
      cache,
    };
  };

  return getFromHandlers(handlers, path, defaultCache);
};
