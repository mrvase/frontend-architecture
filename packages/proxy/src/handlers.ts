import { InjectProxyPayload, ProxyCallback } from "./proxy";
import { Cache } from "./types";
import type {
  HandlerAccumulator,
  HandlerFn,
  HandlerRecord,
  HandlerStore,
  InterceptorFn,
  InterceptorStore,
  ProxyRequest,
  ProxyRequestCache,
} from "./types";

export const globalHandlers = createHandlerStore();
export const globalInterceptors = createInterceptorStore();

const isNonProxyFunction = (fn: unknown): fn is Function => {
  return typeof fn === "function" && !(fn as any)[InjectProxyPayload];
};

// register query/command handlers => should only be used
// register injectable => should only be used within an existing query/command handler
// register event handlers

export function createHandlerStore(...parents: (HandlerStore | undefined)[]): HandlerStore {
  const handlersPublic = new Set<HandlerRecord>();
  const allPublic = new Set<Set<HandlerRecord>>();
  allPublic.add(handlersPublic);

  const handlersPrivate = new Set<HandlerRecord>();
  const allPrivate = new Set<Set<HandlerRecord>>();
  allPrivate.add(handlersPrivate);

  parents.forEach((store) => {
    if (store) {
      store.listPublic().forEach((set) => allPublic.add(set));
      store.listPrivate().forEach((set) => allPrivate.add(set));
    }
  });

  const registerPublic = (...records: HandlerRecord[]) => {
    records.forEach((object) => handlersPublic.add(object));

    return () => {
      records.forEach((object) => handlersPublic.delete(object));
    };
  };

  const registerPrivate = (...records: HandlerRecord[]) => {
    records.forEach((object) => handlersPrivate.add(object));

    return () => {
      records.forEach((object) => handlersPrivate.delete(object));
    };
  };

  const registerPrivateGlobal = (...records: HandlerRecord[]) => {
    // we only need to register to all root parents in order to have maximum reach
    if (parents.length === 0) {
      return registerPrivate(...records);
    }

    const cleanups = [...parents.flatMap((store) => store?.registerPrivateGlobal(...records))];

    return () => {
      cleanups.forEach((fn) => fn?.());
    };
  };

  const get = <T>(request: ProxyRequest<T>, privateScope?: boolean) => {
    const fns: (HandlerFn<T> & { [Cache]?: ProxyRequestCache })[] = [];

    const getFromHandlers = (handlers: Set<HandlerRecord>) => {
      handlers.forEach((initialRecord) => {
        // `get` is used by `proxy`, while `first` is used by `inject`.
        // A proxy intended as an injectable will have the ProxyCallback property.
        // If it itself is requested via a proxy (that is, via `get`),
        // it should deal with the record directly.
        let record = initialRecord as HandlerAccumulator;

        const path = [...request.type];
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
          if (initialRecord[Cache]) {
            Object.assign(fn, { [Cache]: initialRecord[Cache] });
          }
          fns.push(fn as HandlerFn<T>);
        }
      });
    };

    for (const handlers of allPublic) {
      getFromHandlers(handlers);
    }

    if (privateScope) {
      for (const handlers of allPrivate) {
        getFromHandlers(handlers);
      }
    }

    return fns;
  };

  const first = (path: (string | symbol)[]) => {
    const firstFromHandlers = (handlers: Set<HandlerRecord>) => {
      for (const record of handlers) {
        const result = path.reduce((acc: HandlerRecord, key) => acc?.[key] as any, record);

        if (result) {
          return result as HandlerAccumulator;
        }
      }
    };

    for (const handlers of allPublic) {
      const result = firstFromHandlers(handlers);

      if (result) {
        return result;
      }
    }

    for (const handlers of allPrivate) {
      const result = firstFromHandlers(handlers);

      if (result) {
        return result;
      }
    }
  };

  return {
    register: registerPublic,
    registerPublic,
    registerPrivate,
    registerPrivateGlobal,
    get,
    listPublic: () => allPublic,
    listPrivate: () => allPrivate,
    first,
  };
}

export function createInterceptorStore(
  ...parents: (InterceptorStore | undefined)[]
): InterceptorStore {
  const interceptors = new Set<HandlerRecord>();
  const all = new Set<Set<HandlerRecord>>();
  all.add(interceptors);
  parents.forEach((set) => {
    if (set) {
      set.list().forEach((record) => all.add(record));
    }
  });

  const register = (...records: HandlerRecord[]) => {
    records.forEach((object) => interceptors.add(object));

    return () => {
      records.forEach((object) => interceptors.delete(object));
    };
  };

  const get = <T>(request: ProxyRequest<T>) => {
    const fns: InterceptorFn[] = [];

    const getFromHandlers = (handlers: Set<HandlerRecord>) => {
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

    all.forEach(getFromHandlers);

    return fns;
  };

  return {
    register,
    get,
    list: () => all,
  };
}
