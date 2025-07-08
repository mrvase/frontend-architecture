import {
  createProxy,
  getFirstHandler,
  getOptionsContext,
  getRequestContext,
  trackRequestContext,
} from "@nanokit/proxy/internal";
import {
  defaultCache,
  ProxySymbol,
  type HandlerRecord,
  type RequestFn,
} from "@nanokit/proxy";

export function client<T extends HandlerRecord>(record: T): T;
export function client<T extends HandlerRecord>(fetcher: RequestFn): T;
export function client<T extends HandlerRecord>(record: T | RequestFn): T {
  return createProxy((request) => {
    const context = getRequestContext(request);
    const options = { ...context?.options, ...getOptionsContext() };

    const cache =
      typeof record !== "function"
        ? record[ProxySymbol.cache] ?? defaultCache
        : defaultCache;

    const invoke = () => {
      return trackRequestContext(context, () => {
        if (typeof record === "function") {
          return record(request);
        }

        const { result: handler } = getFirstHandler(request.type, record);

        if (typeof handler !== "function") {
          throw new Error(
            `No handler found for: ${request.type
              .map((el) => el.toString())
              .join(".")}`
          );
        }

        return handler(...request.payload);
      });
    };

    if (!context || options.noCache) {
      return invoke();
    }

    if (context.type === "query") {
      return cache.query(request, invoke);
    }

    const prefix = request.type.slice(0, -1);
    const invalidate = () => {
      return cache.invalidate(prefix);
    };

    const result = cache.mutate(request, invoke);

    if (result instanceof Promise) {
      return result.finally(invalidate);
    } else {
      invalidate();
    }

    return result;
  }) as T;
}
