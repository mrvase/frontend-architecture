import { InjectProxyPayload, ProxyCallback } from "./proxy";
import { Cache } from "./types";
import type {
  HandlerAccumulator,
  HandlerFn,
  InterceptorFn,
  ProxyRequest,
  ProxyRequestCache,
  RequestFn,
} from "./types";

export const Proxy: {
  readonly private: unique symbol;
  readonly cache: unique symbol;
} = {
  private: Symbol("private") as typeof Proxy.private,
  cache: Symbol("cache") as typeof Proxy.cache,
};

type Nested<T> = T | Nested<T>[];

type InjectableRecord = {
  [key: string]: unknown;
} & {
  [Proxy.private]?: InjectableRecord;
};

type HandlerRecord = {
  [key: string]: HandlerNode;
} & {
  [Proxy.private]?: HandlerNode | InjectableRecord;
  [Proxy.cache]?: ProxyRequestCache;
};

type HandlerNode = Nested<HandlerFn> | Nested<HandlerRecord | RequestFn>;

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
  [Proxy.private]: { test: new Map<string, string>() },
  [Proxy.cache]: {} as ProxyRequestCache,
} as const satisfies HandlerNode;

type Test = ToProxy<typeof test>;

type InterceptorNode =
  | Nested<InterceptorFn>
  | Nested<{ [key: string | symbol]: InterceptorNode }>;

type UnionToIntersection<U> = (U extends any ? (x: U) => void : never) extends (
  x: infer I
) => void
  ? I
  : never;

type Flatten<T> = T extends any[] ? Flatten<T[number]> : T;

type UnionToProxy<T> = UnionToIntersection<T> extends HandlerNode
  ? ToProxy<UnionToIntersection<T>>
  : {};

type ToProxy<T extends HandlerNode> = RequestFn extends T
  ? {}
  : T extends HandlerFn
  ? T
  : T extends HandlerRecord
  ? {
      -readonly [Key in keyof T as Key extends
        | typeof Proxy.private
        | typeof Proxy.cache
        ? never
        : T[Key] extends []
        ? never
        : Key]: ToProxy<T[Key]>;
    }
  : T extends []
  ? {}
  : T extends [HandlerFn, ...HandlerFn[]][]
  ? T[0] // we assume every handler is equivalent
  : T extends (HandlerRecord | RequestFn)[]
  ? UnionToProxy<Flatten<Exclude<T[number], Function>>> // we assume every function is a RequestFn
  : never;

const isNonProxyFunction = (fn: unknown): fn is Function => {
  return typeof fn === "function" && !(fn as any)[InjectProxyPayload];
};

const getHandlers = <T>(
  request: ProxyRequest<T>,
  handlers: HandlerNode,
  privateScope?: boolean
) => {
  const fns: (HandlerFn<T> & { [Cache]?: ProxyRequestCache })[] = [];

  const getFromHandlers = (
    handlers: HandlerNode,
    path: (string | symbol)[]
  ) => {
    if (Array.isArray(handlers)) {
      handlers.forEach((handler) => getFromHandlers(handler, path));
      return;
    }

    if (
      typeof handlers === "object" &&
      Proxy.private in handlers &&
      privateScope
    ) {
      getFromHandlers(handlers[Proxy.private], path);
    }

    if (typeof handlers === "object") {
      const [first, ...rest] = path;
      const next = handlers[first];

      if (!next) {
        return;
      }

      if (rest.length === 1) {
        return;
      }

      // we need to handle certain cases directly here,
      // because we want to bind the result to the record

      if (isNonProxyFunction(next)) {
        // topic listener
        const fn = next.bind(handlers);
        fns.push(() => fn(request) as T);

        return;
      }

      const proxyCallback = next[ProxyCallback];
      if (proxyCallback) {
        fns.push(() => proxyCallback(request));
        return;
      }

      getFromHandlers(next, rest);
    }

    // `get` is used by `proxy`, while `first` is used by `inject`.
    // A proxy intended as an injectable will have the ProxyCallback property.
    // If it itself is requested via a proxy (that is, via `get`),
    // it should deal with the record directly.

    const [last] = path.splice(path.length - 1, 1);

    for (const key of path) {
      const next = typeof record === "object" ? record[key] : undefined;

      if (!next) {
        return;
      }

      if (isNonProxyFunction(next)) {
        // topic listener
        const fn = next.bind(record);
        fns.push(() => fn(request) as T);

        return;
      }

      const proxyCallback = next[ProxyCallback];
      if (proxyCallback) {
        fns.push(() => proxyCallback(request));
        return;
      }

      record = next;
    }

    if (!isNonProxyFunction(record) && typeof record[last] === "function") {
      const fn = record[last].bind(record);
      if (handlers[Cache]) {
        Object.assign(fn, { [Cache]: handlers[Cache] });
      }
      fns.push(fn as HandlerFn<T>);
    }
  };

  getFromHandlers(handlers, request.type);

  return fns;
};

const getFirstHandler = (
  path: (string | symbol)[],
  handlers: HandlerNode
): unknown => {
  if (Array.isArray(handlers)) {
    for (const record of handlers) {
      const result = getFirstHandler(path, record);
      if (result) {
        return result;
      }
    }
    return;
  }

  if (typeof handlers === "object") {
    const [first, ...rest] = path;
    const next = handlers[first];
    if (next) {
      return getFirstHandler(rest, next);
    }
  }

  if (typeof handlers === "object" && internal in handlers) {
    const result = getFirstHandler(path, handlers[internal]);
    if (result) {
      return result;
    }
  }
};

const getInterceptors = <T>(
  request: ProxyRequest<T>,
  interceptors: InterceptorNode
) => {
  const fns: InterceptorFn[] = [];

  const getFromHandlers = (handlers: InterceptorNode) => {
    if (Array.isArray(handlers)) {
      handlers.forEach(getFromHandlers);
      return;
    }

    if (typeof handlers === "object" && internal in handlers) {
      getFromHandlers(handlers[internal]);
    }

    handlers.forEach((record) => {
      const fn = request.type.reduce(
        (acc, key) => (typeof acc === "object" ? acc[key] : undefined),
        record as HandlerAccumulator | undefined
      );

      if (typeof fn === "function") {
        fns.push(fn as InterceptorFn);
      }
    });
  };

  getFromHandlers(interceptors);

  return fns;
};
