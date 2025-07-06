import type { ProxyRequestCache } from "./cache";
import {
  getRequestContext,
  trackRequestContext,
  type RequestContext,
} from "./context";
import {
  getFirstHandler,
  getHandlers,
  type HandlerFn,
  type HandlerNode,
} from "./handlers";
import { getOptionsContext } from "./options";
import { getSyncTransactionContext, maybeTransaction } from "./transaction";
import { type ProxyRequest, type RequestType } from "./request";

const invoke = <T>(context: RequestContext<T>) => {
  const handlerFns = getHandlers(
    context.request,
    context.handlers,
    Boolean(context.parentRequestId)
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
    }, {} as Map<ProxyRequestCache, HandlerFn<T>[]>);

    for (const [cache, fns] of grouped) {
      cache.dispatch(context.request, () =>
        trackRequestContext(context, () => {
          return fns.map((fn) => fn(...context.request.payload));
        })
      );
    }
    return;
  }

  const handlerFn = handlerFns[0];

  if (!handlerFn) {
    throw new Error(
      `No handlers found for: ${context.request.type
        .map((el) => el.toString())
        .join(".")}`
    );
  }

  if (context.type === "query" && context.options?.noCache) {
    // cache.subscribe(context.request);
    return trackRequestContext(context, () =>
      handlerFn.fn(...context.request.payload)
    );
  }

  return handlerFn.cache[context.type](context.request, () =>
    trackRequestContext(context, () => handlerFn.fn(...context.request.payload))
  );
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

export const createInvokers = (handlersFromArg?: HandlerNode) => {
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

    const handlers = [context?.handlers, handlersFromArg].filter(
      (el) => el !== undefined
    );

    return {
      type,
      request,
      requestId: Math.random().toString(16).slice(2, 10),
      parentRequestId: context?.requestId ?? null,
      handlers,
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

    const dispatchResult = maybeTransaction(
      () => invoke(context),
      request
    ) as Promise<void>;

    if (context.transaction && dispatchResult instanceof Promise) {
      context.transaction.promises.push(dispatchResult);
    }
  };

  const redispatch = <T>(prefix: string) => {
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
    const handlers = getRequestContext()?.handlers ?? handlersFromArg ?? [];

    if (typeof type[0] === "object") {
      const { cache } = getFirstHandler(type[0].type, handlers);
      cache?.invalidate(type[0]);
    } else {
      const { cache } = getFirstHandler(type as string[], handlers);
      cache?.invalidate(type as string[]);
    }
  };

  const cache = <T>(request: ProxyRequest<T>, value: T) => {
    const handlers = getRequestContext()?.handlers ?? handlersFromArg ?? [];
    const { cache } = getFirstHandler(request.type, handlers);

    cache?.set(request, value);
  };

  return { query, mutate, dispatch, redispatch, invalidate, cache };
};

export const globalInvokers = createInvokers();

export type Invokers = ReturnType<typeof createInvokers>;
