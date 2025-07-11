import type { HandlerNode } from "./handlers";
import type { ProxyRequest, RequestType } from "./request";

export type RequestTransaction<
  TAttributes extends Record<string, unknown> = Record<string, unknown>
> = {
  promises: Promise<unknown>[];
  onSuccess: (() => void)[];
  onError: (() => void)[];
  attributes: TAttributes;
};

export type RequestOptions = {
  noCache?: boolean;
};

export type RequestContext<T = unknown> = {
  type: RequestType;
  request: ProxyRequest<T>;
  requestId: string;
  parentRequestId: string | null;
  handlers: HandlerNode;
  transaction?: RequestTransaction;
  options?: RequestOptions;
};

const REQUEST_CONTEXT = Symbol("REQUEST_CONTEXT");

type LoadedRequest = ProxyRequest<any> & {
  [REQUEST_CONTEXT]: RequestContext | undefined;
};

export function addRequestContext<T>(
  request: ProxyRequest<T>,
  context?: RequestContext
): ProxyRequest<T> {
  return Object.assign(request, {
    [REQUEST_CONTEXT]:
      context ?? // this is first so we can override context
      getRequestContext() ??
      (request as LoadedRequest)[REQUEST_CONTEXT],
  }) satisfies LoadedRequest;
}

let CurrentRequestContext: RequestContext | undefined = undefined;

export function getRequestContext(
  request?: ProxyRequest
): RequestContext | undefined {
  return (
    CurrentRequestContext ??
    (request as LoadedRequest)?.[REQUEST_CONTEXT] ??
    undefined
  );
}

export function trackRequestContext<T>(
  context: RequestContext | undefined,
  fn: () => T
): T {
  const prevContext = CurrentRequestContext;
  CurrentRequestContext = context;
  try {
    return fn();
  } finally {
    CurrentRequestContext = prevContext;
  }
}

export type HandlersContext = {
  handlers: HandlerNode;
};

const HANDLERS_CONTEXT = Symbol("HANDLERS_CONTEXT");

type LoadedHandlersRequest = ProxyRequest<any> & {
  [HANDLERS_CONTEXT]: HandlersContext | undefined;
};

export function addHandlersContext<T extends RequestValue>(
  request: ProxyRequest<T>,
  context?: HandlersContext
): ProxyRequest<T> {
  return Object.assign(request, {
    [HANDLERS_CONTEXT]:
      context ?? // this is first so we can override context
      getHandlersContext() ??
      (request as LoadedHandlersRequest)[HANDLERS_CONTEXT],
  }) satisfies LoadedHandlersRequest;
}

let CurrentHandlersContext: HandlersContext | undefined = undefined;

export function getHandlersContext(
  request?: ProxyRequest
): HandlersContext | undefined {
  return (
    CurrentHandlersContext ??
    (request as LoadedHandlersRequest)?.[HANDLERS_CONTEXT] ??
    undefined
  );
}

export function trackHandlersContext<T>(
  context: HandlersContext | undefined,
  fn: () => T
): T {
  const prevContext = CurrentHandlersContext;
  CurrentHandlersContext = context;
  try {
    return fn();
  } finally {
    CurrentHandlersContext = prevContext;
  }
}
