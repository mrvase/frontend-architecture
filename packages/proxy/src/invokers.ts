import { defaultCache } from "./cache";
import { getRequestContext, trackRequestContext, type RequestContext } from "./context";
import {
  createHandlerStore,
  createInterceptorStore,
  globalHandlers,
  globalInterceptors,
} from "./handlers";
import { getOptionsContext } from "./options";
import { getSyncTransactionContext, maybeTransaction } from "./transaction";
import {
  Cache,
  type HandlerFn,
  type HandlerStore,
  type InterceptorStore,
  type ProxyRequest,
  type ProxyRequestCache,
  type RequestType,
} from "./types";

const invoke = <T>(context: RequestContext<T>) => {
  const handlerFns = context.handlers.get(context.request, Boolean(context.parentRequestId));

  const interceptorFns = context.interceptors.get(context.request);

  const interceptPayload = (payload: unknown[]) => {
    if (context.type === "mutate" && interceptorFns.length) {
      let [first, ...rest] = payload;
      first = interceptorFns.reduce((acc, cur) => cur(acc, ...rest), first);
      return [first, ...rest];
    }
    return payload;
  };

  const interceptResult = (result: T, payload: unknown[]): T => {
    if (context.type === "query" && interceptorFns.length) {
      return interceptorFns.reduce((acc, cur) => cur(acc, ...payload), result);
    }
    return result;
  };

  const invokeParallel = () => {
    return trackRequestContext(context, () => {
      const payload = interceptPayload(context.request.payload);
      return handlerFns.map((fn) => interceptResult(fn(...payload), payload));
    });
  };

  const invokeFirst = (fn: HandlerFn<T>) => {
    return trackRequestContext(context, () => {
      const payload = interceptPayload(context.request.payload);

      return interceptResult(fn(...interceptPayload(context.request.payload)), payload);
    });
  };

  if (context.type === "dispatch") {
    return context.cache.dispatch(context.request, invokeParallel);
  }

  const handlerFn = handlerFns[0];

  if (!handlerFn) {
    throw new Error(
      `No handlers found for: ${context.request.type.map((el) => el.toString()).join(".")}`
    );
  }

  if (context.type === "query" && context.options?.noCache) {
    // cache.subscribe(context.request);
    return invokeFirst(handlerFn);
  }

  const cache = handlerFn[Cache] ?? context.cache;

  return cache[context.type](context.request, () => invokeFirst(handlerFn));
};

export type RequestLog = {
  requestId: string;
  parentRequestId: string | null;
  type: string;
  request: ProxyRequest;
};
type RequestLogListener = (request: RequestLog) => void;

const listeners = new Set<RequestLogListener>();

const pushRequestLog = (log: RequestLog) => {
  listeners.forEach((fn) => fn(log));
};

export const registerRequestLogListener = (listener: RequestLogListener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const createInvokers = (
  setup: {
    handlers?: HandlerStore;
    interceptors?: InterceptorStore;
    cache?: ProxyRequestCache;
  } = {}
) => {
  const getNextRequestContext = <T>({
    type,
    request,
  }: {
    type: RequestType;
    request: ProxyRequest<T>;
  }): RequestContext<T> => {
    const context = getRequestContext(request);

    const transaction = context?.transaction ?? getSyncTransactionContext();
    const options = { ...context?.options, ...getOptionsContext() };

    const handlers = createHandlerStore(context?.handlers, setup.handlers ?? globalHandlers);
    const interceptors = createInterceptorStore(
      context?.interceptors,
      setup.interceptors ?? globalInterceptors
    );

    const cache = context?.cache ?? setup.cache ?? defaultCache;

    return {
      type,
      request,
      requestId: Math.random().toString(16).slice(2, 10),
      parentRequestId: context?.requestId ?? null,
      handlers,
      interceptors,
      cache,
      transaction,
      options,
    };
  };

  const query = <T>(request: ProxyRequest<T>) => {
    const context = getNextRequestContext({ type: "query", request });
    return invoke(context) as T;
  };

  const mutate = <T>(request: ProxyRequest<T>) => {
    const context = getNextRequestContext({ type: "mutate", request });

    pushRequestLog({
      type: "mutate",
      request,
      requestId: context.requestId,
      parentRequestId: context.parentRequestId,
    });

    return maybeTransaction(() => invoke(context), request) as T;
  };

  const dispatch = <T>(request: ProxyRequest<T>) => {
    const context = getNextRequestContext({ type: "dispatch", request });

    pushRequestLog({
      type: "dispatch",
      request,
      requestId: context.requestId,
      parentRequestId: context.parentRequestId,
    });

    const dispatchResult = maybeTransaction(() => invoke(context), request) as Promise<void>;

    if (context.transaction && dispatchResult instanceof Promise) {
      context.transaction.promises.push(dispatchResult);
    }
  };

  const redispatch = <T>(prefix: string | symbol) => {
    const request = getRequestContext()?.request;

    if (!request) {
      throw new Error("No request context found");
    }

    const newRequest = {
      ...request,
      type: [prefix, ...request.type.slice(1)],
    };

    return dispatch(newRequest);
  };

  const invalidate = (...type: [string | symbol, ...(string | symbol)[]] | [ProxyRequest]) => {
    const cache = getRequestContext()?.cache ?? setup.cache ?? defaultCache;

    if (typeof type[0] === "object") {
      cache.invalidate(type[0]);
    } else {
      cache.invalidate(type as (string | symbol)[]);
    }
  };

  const cache = <T>(request: ProxyRequest<T>, value: T) => {
    const cache = getRequestContext()?.cache ?? setup.cache ?? defaultCache;

    cache.set(request, value);
  };

  return { query, mutate, dispatch, redispatch, invalidate, cache };
};

export const globalInvokers = createInvokers();

export type Invokers = ReturnType<typeof createInvokers>;
