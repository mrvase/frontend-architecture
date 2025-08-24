import type { ProxyRequest, RequestValue } from "./request";

export type ProxyRequestCache<TCachedValue = unknown> = {
  query: <T extends RequestValue>(request: ProxyRequest<T>, invoke: () => T) => T;
  mutate: <T extends RequestValue>(request: ProxyRequest<T>, invoke: () => T) => T;
  dispatch: <T extends RequestValue>(request: ProxyRequest<T>, invoke: () => T[]) => Promise<void>;
  invalidate: (type: (string | symbol)[] | ProxyRequest) => void;
  set: <T extends RequestValue>(request: ProxyRequest<T>, value: T) => void;
  getCachedData?: (request: ProxyRequest) => TCachedValue | undefined;
};

export const defaultCache: ProxyRequestCache = {
  query: (_, invoke) => {
    return invoke();
  },
  mutate: (_, invoke) => {
    return invoke();
  },
  dispatch: async (_, invoke) => {
    invoke();
  },
  invalidate: () => {},
  set: () => {},
};
