import type { ProxyRequestCache } from "./cache";
import {
  getHandlersContext,
  getRequestContext,
  trackRequestContext,
  type RequestContext,
} from "./context";
import { getFirstHandler, getHandlers, type HandlerFn, type HandlerNode } from "./handlers";
import { getOptionsContext } from "./options";
import { getSyncTransactionContext, maybeTransaction } from "./transaction";
import { type ProxyRequest, type RequestType, type RequestValue } from "./request";

const invoke = <T extends RequestValue>(context: RequestContext<T>) => {
  const handlerFns = trackRequestContext(context, () =>
    getHandlers(context.request, context.handlers, Boolean(context.parentRequestId))
  );

  if (context.type === "dispatch") {
    // group by cache
    const grouped = handlerFns.reduce((acc, fn) => {
      const cache = fn.cache;
      let current = acc.get(cache);
      if (!current) {
        current = [];
        acc.set(cache, current);
      }
      current.push(fn.fn);
      return acc;
    }, new Map<ProxyRequestCache, HandlerFn<T>[]>());

    const promises: Promise<void>[] = [];

    for (const [cache, fns] of grouped) {
      const invokeAll = () => {
        return trackRequestContext(context, () => fns.map((fn) => fn(...context.request.payload)));
      };

      promises.push(cache.dispatch(context.request, invokeAll));
    }

    return Promise.all(promises).then(() => {});
  }

  const evaluateTransforms = (value: RequestValue): T => {
    const transforms = context.request.transforms;
    if (!transforms) {
      return value as T;
    }
    return transforms.reduce((acc, fn) => fn(acc), value) as T;
  };

  const handlerFn = handlerFns[0];

  if (!handlerFn) {
    throw new Error(
      `No handlers found for: ${context.request.type.map((el) => el.toString()).join(".")}`
    );
  }

  const invokeFirst = () => {
    return trackRequestContext(context, () =>
      evaluateTransforms(handlerFn.fn(...context.request.payload))
    );
  };

  if (context.type === "query" && context.options?.noCache) {
    // cache.subscribe(context.request);
    return invokeFirst();
  }

  return handlerFn.cache[context.type](context.request, invokeFirst);
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

export const createInvokers = (handlers?: HandlerNode) => {
  const getNextRequestContext = <T extends RequestValue>({
    type,
    request,
  }: {
    type: RequestType;
    request: ProxyRequest<T>;
  }): RequestContext<T> => {
    const context = getRequestContext(request);
    const handlersContext = getHandlersContext(request);

    const transaction = context?.transaction ?? getSyncTransactionContext();
    const options = { ...context?.options, ...getOptionsContext() };

    const nextHandlers = [context?.handlers ?? handlersContext?.handlers, handlers].filter(
      (el) => el !== undefined
    );

    return {
      type,
      request,
      requestId: Math.random().toString(16).slice(2, 10),
      parentRequestId: context?.requestId ?? null,
      handlers: nextHandlers,
      transaction,
      options,
    };
  };

  const query = <T extends RequestValue>(request: ProxyRequest<T>) => {
    const context = getNextRequestContext({ type: "query", request });
    return invoke(context) as T;
  };

  const mutate = <T extends RequestValue>(request: ProxyRequest<T>) => {
    const context = getNextRequestContext({ type: "mutate", request });

    pushRequestLog({
      type: "mutate",
      request,
      requestId: context.requestId,
      parentRequestId: context.parentRequestId,
    });

    return maybeTransaction(() => invoke(context), request) as T;
  };

  const dispatch = <T extends RequestValue>(request: ProxyRequest<T>) => {
    const context = getNextRequestContext({ type: "dispatch", request });

    pushRequestLog({
      type: "dispatch",
      request,
      requestId: context.requestId,
      parentRequestId: context.parentRequestId,
    });

    const dispatchResult = maybeTransaction(() => invoke(context), request);

    if (context.transaction && dispatchResult instanceof Promise) {
      context.transaction.promises.push(dispatchResult);
    }
  };

  const redispatch = (prefix: string) => {
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

  const invalidate = (...type: [string, ...string[]] | [ProxyRequest]) => {
    const nextHandlers = getRequestContext()?.handlers ?? handlers ?? [];

    if (typeof type[0] === "object") {
      const { cache } = getFirstHandler(type[0].type, nextHandlers);
      cache?.invalidate(type[0]);
    } else {
      const { cache } = getFirstHandler(type as string[], nextHandlers);
      cache?.invalidate(type as string[]);
    }
  };

  const setCache = <T extends RequestValue>(request: ProxyRequest<T>, value: T) => {
    const nextHandlers = getRequestContext()?.handlers ?? handlers ?? [];
    const { cache } = getFirstHandler(request.type, nextHandlers);

    cache?.set(request, value);
  };

  return { query, mutate, dispatch, redispatch, invalidate, setCache };
};

export type Invokers = ReturnType<typeof createInvokers>;
export type Query = Invokers["query"];
export type Mutate = Invokers["mutate"];
export type Dispatch = Invokers["dispatch"];
export type Invalidate = Invokers["invalidate"];
export type SetCache = Invokers["setCache"];

export const invokers = createInvokers();

export const { query, mutate, dispatch, redispatch, invalidate, setCache } = invokers;
