import type { ProxyRequestCache } from "./cache";
import {
  getRequestContext,
  addRequestContext,
  type RequestContext,
} from "./context";
import {
  getFirstHandler,
  ProxySymbol,
  type HandlerFn,
  type HandlerNode,
  type HandlerRecord,
  type InjectableRecord,
  type RequestFn,
} from "./handlers";
import { type ProxyRequest, type ProxyEvent } from "./request";

type ProxyHandlerRecord = {
  [key: string]: ProxyHandlerNode;
};
type ProxyHandlerNode = HandlerFn | ProxyHandlerRecord;

type ProxyInjectableRecord = {
  [key: string]: unknown;
};

type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

type UnionToIntersection<U> = (U extends any ? (x: U) => void : never) extends (
  x: infer I
) => void
  ? I
  : never;

type Flatten<T> = T extends any[] ? Flatten<T[number]> : T;

type FromUnion<T> = UnionToIntersection<T> extends HandlerNode
  ? InferHandlers<UnionToIntersection<T>>
  : {};

export type InferInjectables<T extends InjectableRecord> = {
  [Key in keyof T as Key extends typeof ProxySymbol.private
    ? never
    : Key]: T[Key];
};

export type InferHandlers<T extends HandlerNode> = RequestFn extends T
  ? {}
  : T extends HandlerFn
  ? T
  : T extends HandlerRecord
  ? {
      -readonly [Key in keyof T as Key extends
        | typeof ProxySymbol.private
        | typeof ProxySymbol.cache
        ? never
        : T[Key] extends []
        ? never
        : Key]: InferHandlers<T[Key]>;
    }
  : T extends []
  ? {}
  : T extends [HandlerFn, ...HandlerFn[]][]
  ? T[0] // we assume every handler is equivalent
  : T extends (HandlerRecord | RequestFn)[]
  ? FromUnion<Flatten<Exclude<T[number], Function>>> // we assume every function is a RequestFn
  : never;

type ToProxyFn<K extends string, T extends HandlerFn> = T extends (
  ...args: any
) => infer R
  ? (...args: Parameters<T>) => R extends (arg: any) => any
      ? ProxyEvent<
          Prettify<
            {
              type: K;
            } & Parameters<T>[0]
          >
        >
      : ProxyRequest<ReturnType<T>>
  : never;

export type ToProxy<
  T extends ProxyHandlerRecord | HandlerFn,
  K extends string = never
> = T extends HandlerFn
  ? ToProxyFn<K, T>
  : T extends ProxyHandlerRecord
  ? {
      -readonly [Key in keyof T]: ToProxy<
        T[Key],
        Key extends string ? Key : never
      >;
    }
  : never;

export interface Handlers extends ProxyHandlerRecord {}
export interface Injectables extends ProxyInjectableRecord {}

export type ProxyPayload<TValue = unknown> = {
  path: (string | symbol)[];
  context: RequestContext<TValue> | undefined;
  isInjected: boolean;
};

export const createProxyRequest = <T>(
  type: (string | symbol)[],
  payload: unknown[] = [],
  transforms?: ((value: unknown) => unknown)[]
): ProxyRequest<T> => {
  return addRequestContext({
    type,
    payload,
    select: (callback) => {
      return createProxyRequest(type, payload, [
        ...(transforms ?? []),
        callback as (value: unknown) => unknown,
      ]);
    },
    ...(transforms ? { transforms } : {}),
  } as ProxyRequest<T>);
};

export function inject<T extends string>(prefix: T): Injectables[T];
export function inject<T extends object>(prefix: string): T;
export function inject<T extends string | object>(prefix: string) {
  const context = getRequestContext();
  if (!context) {
    throw new Error("Cannot use inject strategy outside of a request context");
  }

  const path = [prefix];

  const { result } = getFirstHandler(path, context.handlers);

  if (result) {
    if (
      result &&
      typeof result === "object" &&
      ProxySymbol.onInject in result &&
      result[ProxySymbol.onInject]
    ) {
      return (result[ProxySymbol.onInject] as any)({
        isInjected: true,
        path,
        context,
      });
    }
    return result;
  }

  throw new Error(
    `No injectable found for: ${path.map((el) => el.toString()).join(".")}`
  );
}

export const getRequestType = () => {
  const ctx = getRequestContext();
  if (!ctx) {
    throw new Error("Tried calling getRequestType outside a request context.");
  }
  return ctx.type;
};

export function createProxy(
  callback: (request: ProxyRequest) => unknown
): unknown {
  const create = (payload?: ProxyPayload) => {
    const context = getRequestContext() ?? payload?.context;
    const path = payload?.path ?? [];

    const fn = (...args: unknown[]) => {
      const request = addRequestContext(
        createProxyRequest(path, args),
        context
      );
      return callback(request);
    };

    return new Proxy(fn, {
      get(_, key) {
        if (key === ProxySymbol.onInject) {
          return create;
        }
        if (key === ProxySymbol.unwrap) {
          return (request: ProxyRequest) => callback(request);
        }
        return create({
          isInjected: payload?.isInjected ?? false,
          path: [...path, key],
          context,
        });
      },
      has(_, key) {
        return (
          key in fn ||
          key === ProxySymbol.onInject ||
          key === ProxySymbol.unwrap
        );
      },
      set() {
        throw new Error("Proxy objects are read-only");
      },
    });
  };

  return create(undefined);
}

export function proxy<T extends keyof Handlers>(
  prefix: T
): ToProxy<Handlers>[T];
export function proxy<T extends ProxyHandlerRecord = Handlers>(): ToProxy<T>;
export function proxy<T extends keyof Handlers | ProxyHandlerRecord>(
  prefix?: T
) {
  const obj = createProxy((request) => request) as T;
  return prefix ? obj[prefix as keyof typeof obj] : obj;
}

const test = {
  test: {
    hello: [
      {
        bla: () => {},
      },
      {
        test: (id: string) => {},
      },
    ],
  },
  [ProxySymbol.private]: { test: new Map<string, string>() },
  [ProxySymbol.cache]: {} as ProxyRequestCache,
} as const satisfies HandlerNode;

type ProxyTest = typeof test;
