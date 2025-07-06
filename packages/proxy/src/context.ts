import type {
  HandlerStore,
  InterceptorStore,
  ProxyRequest,
  ProxyRequestCache,
  RequestType,
} from "./types";

export type RequestTransaction<
  TAttributes extends Record<string, unknown> = Record<string, unknown>,
> = {
  promises: Promise<unknown>[];
  onSuccess: (() => void)[];
  onError: (() => void)[];
  attributes: TAttributes;
};

export type RequestOptions = {
  noCache?: boolean;
};

export type RequestContext<T = unknown, TCachedValue = unknown> = {
  type: RequestType;
  request: ProxyRequest<T>;
  requestId: string;
  parentRequestId: string | null;
  handlers: HandlerStore;
  interceptors: InterceptorStore;
  cache: ProxyRequestCache<TCachedValue>;
  transaction?: RequestTransaction;
  options?: RequestOptions;
};

export const REQUEST_CONTEXT = Symbol("REQUEST_CONTEXT");

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

export function getRequestContext(request?: ProxyRequest): RequestContext | undefined {
  return CurrentRequestContext ?? (request as LoadedRequest)?.[REQUEST_CONTEXT] ?? undefined;
}

export function trackRequestContext<T>(context: RequestContext | undefined, fn: () => T): T {
  const prevContext = CurrentRequestContext;
  CurrentRequestContext = context;
  try {
    return fn();
  } finally {
    CurrentRequestContext = prevContext;
  }
}
