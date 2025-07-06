import { getRequestContext, addRequestContext, type RequestContext } from "./context";
import { Cache, type HandlerRecord, type ProxyRequest, type ProxyEvent } from "./types";

type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

export type ProxyClient<T> =
  T extends Record<string | symbol, unknown>
    ? {
        [K in keyof T as K extends typeof Cache ? never : K]: T[K] extends (...args: any) => infer R
          ? (...args: Parameters<T[K]>) => R extends (arg: any) => any
              ? ProxyEvent<
                  Prettify<
                    {
                      type: K;
                    } & Parameters<T[K]>[0]
                  >
                >
              : ProxyRequest<ReturnType<T[K]>>
          : ProxyClient<T[K]>;
      }
    : T;

export interface Proxy extends Record<string | symbol, unknown> {}
export interface Inject extends Record<string | symbol, unknown> {}

export type ProxyPayload<TValue = unknown, TCachedValue = unknown> = {
  path: (string | symbol)[];
  context: RequestContext<TValue, TCachedValue> | undefined;
  isInjected: boolean;
};

export const createProxyRequest = <T>(
  type: (string | symbol)[],
  payload: unknown[] = []
): ProxyRequest<T> => {
  return addRequestContext({
    type,
    payload,
  } as ProxyRequest<T>);
};

export function inject<T extends string | symbol>(prefix: T): Inject[T];
export function inject<T extends object>(prefix: string | symbol): T;
export function inject<T extends string | symbol | HandlerRecord>(prefix: string | symbol) {
  const context = getRequestContext();
  if (!context) {
    throw new Error("Cannot use inject strategy outside of a request context");
  }

  const path = [prefix];

  const result = context.handlers.first(path);

  if (result) {
    if (result[InjectProxyPayload]) {
      return result[InjectProxyPayload]({
        isInjected: true,
        path,
        context,
      });
    }
    return result;
  }

  throw new Error(`No injectable found for: ${path.map((el) => el.toString()).join(".")}`);
}

export const getRequestType = () => {
  const ctx = getRequestContext();
  if (!ctx) {
    throw new Error("Tried calling getRequestType outside a request context.");
  }
  return ctx.type;
};

export const ProxyCallback = Symbol("ProxyCallback");
export const InjectProxyPayload = Symbol("InjectProxyPayload");

export function createProxyObject(
  callback: (request: ProxyRequest, params: { isInjected: boolean }) => unknown
): unknown {
  const create = (payload?: ProxyPayload) => {
    const context = getRequestContext() ?? payload?.context;
    const path = payload?.path ?? [];

    const fn = (...args: unknown[]) => {
      const request = addRequestContext(createProxyRequest(path, args), context);
      return callback(request, { isInjected: payload?.isInjected ?? false });
    };

    return new Proxy(fn, {
      get(_, key) {
        if (key === InjectProxyPayload) {
          return create;
        } else if (key === ProxyCallback) {
          return (request: ProxyRequest) =>
            callback(request, { isInjected: payload?.isInjected ?? false });
        }
        return create({
          isInjected: payload?.isInjected ?? false,
          path: [...path, key],
          context,
        });
      },
      set() {
        throw new Error("Proxy objects are read-only");
      },
    });
  };

  return create(undefined);
}

export function proxy<T extends keyof Proxy>(prefix: T): ProxyClient<Proxy>[T];
export function proxy<T extends HandlerRecord = Proxy>(): ProxyClient<T>;
export function proxy<T extends keyof Proxy | HandlerRecord>(prefix?: T) {
  const obj = createProxyObject((request) => request) as ProxyClient<HandlerRecord>;
  return prefix ? obj[prefix as keyof typeof obj] : obj;
}
