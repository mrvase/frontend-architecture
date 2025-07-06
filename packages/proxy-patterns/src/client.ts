import {
  createProxyObject,
  getOptionsContext,
  getRequestContext,
  trackRequestContext,
  type HandlerAccumulator,
} from "@nanokit/proxy/internal";
import { Cache, defaultCache, type ProxyRequest, type ProxyRequestCache } from "@nanokit/proxy";

export const getHandler = <T>(request: ProxyRequest<T>, record: Record<string, unknown>) => {
  const fn = request.type.reduce(
    // since the request might include some prefix in the path
    // that is not present in the record, we need to gracefully
    // handle this case with the nullish coalescing operator
    (acc, key) => (typeof acc === "object" ? (acc[key] ?? acc) : undefined),
    record as HandlerAccumulator | undefined
  );

  if (typeof fn !== "function") {
    throw new Error(`No handler found for: ${request.type.map((el) => el.toString()).join(".")}`);
  }

  return fn;
};

export function client<T extends Record<string, unknown> & { [Cache]?: ProxyRequestCache }>(
  record: T
): T;
export function client<T extends Record<string, unknown> & { [Cache]?: ProxyRequestCache }>(
  fetcher: ((request: ProxyRequest) => any) & { [Cache]?: ProxyRequestCache }
): T;
export function client<T extends Record<string, unknown> & { [Cache]?: ProxyRequestCache }>(
  record: T | (((request: ProxyRequest) => any) & { [Cache]?: ProxyRequestCache })
): T {
  return createProxyObject((request, { isInjected }) => {
    const context = getRequestContext(request);
    const options = { ...context?.options, ...getOptionsContext() };

    const invoke = () => {
      return trackRequestContext(context, () => {
        if (typeof record === "function") {
          return record(request);
        }
        return getHandler(request, record)(...request.payload);
      });
    };

    if (!context || options.noCache) {
      return invoke();
    }

    const cache = isInjected ? (record[Cache] ?? context.cache) : defaultCache;

    if (context.type === "query") {
      return cache.query(request, invoke);
    }

    const prefix = request.type.slice(0, -1);
    const invalidate = () => cache.invalidate(prefix);

    const result = cache.mutate(request, invoke);

    if (result instanceof Promise) {
      return result.finally(invalidate);
    } else {
      invalidate();
    }

    return result;
  }) as T;
}
