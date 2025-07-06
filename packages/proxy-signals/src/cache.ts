import { createProxyRequest, type ProxyRequestCache } from "@nanokit/proxy";
import {
  getRequestContext,
  getTransactionContext,
} from "@nanokit/proxy/internal";
import { stabilize } from "./signals/signals";
import { ReactiveExtended } from "./signals/signals-extended";
import { deepEquals, getKey } from "./utils";

let stabilizationQueued = false;
function deferredStabilize(): void {
  if (!stabilizationQueued) {
    stabilizationQueued = true;

    queueMicrotask(() => {
      stabilizationQueued = false;
      stabilize();
    });
  }
}

export const createSignalCache = () => {
  const cachedRequests = new Map<string, ReactiveExtended<any>>();

  const cache: ProxyRequestCache<ReactiveExtended<any>> = {
    query: (request, invoke) => {
      const context = getRequestContext(request);
      const isSync = Boolean(getRequestContext());

      const key = getKey(request);

      let cached = cachedRequests.get(key);

      if (cached === undefined) {
        cached = new ReactiveExtended(() => invoke());
        cached.equals = deepEquals;
        cachedRequests.set(key, cached);
      }

      const parentSignal =
        context && !isSync
          ? cachedRequests.get(getKey(context.request))
          : undefined;

      return cached.get(parentSignal);
    },
    mutate: (request, invoke) => {
      const transactionRoot = getTransactionContext();
      transactionRoot?.onSuccess.push(deferredStabilize);
      transactionRoot?.onError.push(deferredStabilize);
      try {
        const result = invoke();
        return result;
      } finally {
        if (transactionRoot) {
          deferredStabilize();
        }
      }
    },
    dispatch: async (request, invoke) => {
      getTransactionContext()?.onSuccess.push(deferredStabilize);
      getTransactionContext()?.onError.push(deferredStabilize);
      await Promise.all(invoke());
    },
    invalidate: (type) => {
      if (Array.isArray(type)) {
        const key = getKey(createProxyRequest(type));
        for (const [cachedKey, signal] of cachedRequests) {
          if (cachedKey.startsWith(key)) {
            signal.refresh();
            // cachedRequests.delete(cachedKey);
            // signal.dispose();
          }
        }
      } else {
        const key = getKey(type);
        cachedRequests.get(key)?.refresh();
      }
      deferredStabilize();
    },
    set: (request, value) => {
      const key = getKey(request);
      const cached = cachedRequests.get(key);
      if (cached) {
        cached.set(() => value);
      } else {
        cachedRequests.set(key, new ReactiveExtended(() => value));
      }
    },
    getCachedData(request) {
      const key = getKey(request);
      return cachedRequests.get(key);
    },
  };

  return cache;
};
