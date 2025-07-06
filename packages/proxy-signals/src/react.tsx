import {
  useQueryClient,
  useQuery as useQueryBase,
  useMutationState as useMutationStateBase,
  skipToken,
  type UseQueryResult,
  type MutationOptions,
  type MutationState,
} from "@tanstack/react-query";
import {
  useSyncExternalStore,
  createContext,
  useContext,
  useMemo,
  useRef,
  useCallback,
  useEffect,
} from "react";
import {
  defaultCache,
  createInvokers,
  globalInvokers,
  createHandlerStore,
  createInterceptorStore,
  globalHandlers,
  globalInterceptors,
  type Invokers,
  type HandlerRecord,
  type HandlerStore,
  type InterceptorStore,
  type ProxyRequest,
  type ProxyRequestCache,
  Cache,
  type Inject,
} from "@nanokit/proxy";
import { ReactiveExtended } from "./signals/signals-extended";
import { getKey } from "./utils";
import { createSignalCache } from "./cache";

const CacheContext = createContext<ProxyRequestCache>(defaultCache);
const InvokersContext = createContext<Invokers>(globalInvokers);
const HandlersContext = createContext<HandlerStore>(globalHandlers);
const InterceptorsContext = createContext<InterceptorStore>(globalInterceptors);

export function CacheProvider({
  cache,
  children,
}: {
  cache: ProxyRequestCache;
  children: React.ReactNode;
}) {
  return <CacheContext.Provider value={cache}>{children}</CacheContext.Provider>;
}

export function useSignalCache() {
  return useContext(CacheContext);
}

export function DependenciesProvider({
  handlers,
  interceptors,
  children,
}: {
  handlers?: HandlerStore;
  interceptors?: InterceptorStore;
  children: React.ReactNode;
}) {
  const parentHandlers = useContext(HandlersContext);
  const parentInterceptors = useContext(InterceptorsContext);
  const cache = useContext(CacheContext);

  const nextHandlers = useMemo(() => {
    // we want the new handlers to be found first so that inner contexts
    // are prioritized over outer contexts
    return handlers ? createHandlerStore(handlers, parentHandlers) : parentHandlers;
  }, [handlers, parentHandlers]);

  const nextInterceptors = useMemo(() => {
    // we want the new handlers to be found first so that inner contexts
    // are prioritized over outer contexts
    return interceptors
      ? createInterceptorStore(interceptors, parentInterceptors)
      : parentInterceptors;
  }, [interceptors, parentInterceptors]);

  const invokers = useMemo(
    () =>
      createInvokers({
        handlers: nextHandlers,
        interceptors: nextInterceptors,
        cache,
      }),
    [nextHandlers, nextInterceptors]
  );

  return (
    <HandlersContext.Provider value={nextHandlers}>
      <InterceptorsContext.Provider value={nextInterceptors}>
        <InvokersContext.Provider value={invokers}>{children}</InvokersContext.Provider>
      </InterceptorsContext.Provider>
    </HandlersContext.Provider>
  );
}

export function StoreProvider({
  handlers,
  cache: cacheFromArg,
  children,
}: {
  handlers: HandlerRecord;
  cache?: ProxyRequestCache;
  children: React.ReactNode;
}) {
  const parentHandlers = useContext(HandlersContext);
  const parentInterceptors = useContext(InterceptorsContext);
  const parentCache = useContext(CacheContext);
  const cache = useMemo(
    () => cacheFromArg ?? (handlers[Cache] as ProxyRequestCache | undefined) ?? createSignalCache(),
    [cacheFromArg]
  );

  const nextHandlers = useMemo(() => {
    const store = createHandlerStore();
    store.register({ ...handlers, [Cache]: cache });
    // we want the new handlers to be found first so that inner contexts
    // are prioritized over outer contexts
    return createHandlerStore(store, parentHandlers);
  }, [handlers, parentHandlers]);

  const invokers = useMemo(
    () =>
      createInvokers({
        handlers: nextHandlers,
        interceptors: parentInterceptors,
        cache: parentCache,
      }),
    [nextHandlers, parentInterceptors, parentCache]
  );

  return (
    <HandlersContext.Provider value={nextHandlers}>
      <InvokersContext.Provider value={invokers}>{children}</InvokersContext.Provider>
    </HandlersContext.Provider>
  );
}

export function useInvokers() {
  return useContext(InvokersContext);
}

export const useDispatch = () => {
  return useContext(InvokersContext).dispatch;
};

export const useMutate = () => {
  return useContext(InvokersContext).mutate;
};

export const useObservedMutate = (
  options?: MutationOptions<unknown, unknown, unknown, unknown>
) => {
  const queryClient = useQueryClient();
  const mutate = useMutate();

  return useCallback(
    <T extends Promise<any>>(req: ProxyRequest<T>): T => {
      const mutation = queryClient.getMutationCache().build(queryClient, {
        mutationFn: () => mutate(req),
        mutationKey: [...req.type, ...req.payload],
        ...options,
      });

      return mutation.execute(undefined) as T;
    },
    [queryClient, mutate]
  );
};

export const useMutationState = <T extends Promise<any>>(
  req: ProxyRequest<T> | undefined
): MutationState<unknown, Error, unknown, unknown> | undefined => {
  const queryClient = useQueryClient();
  return useMutationStateBase(
    {
      filters: {
        mutationKey: req ? [...req.type, ...req.payload] : [],
        exact: true,
      },
      select: (mutation) => mutation.state,
    },
    queryClient
  )[0];
};

export const useHandlerStore = () => {
  return useContext(HandlersContext);
};

export const useHandlers = (handlers?: HandlerRecord) => {
  const ctx = useContext(HandlersContext);

  const register = useCallback(
    (handlers: HandlerRecord) => {
      return ctx.register(handlers);
    },
    [ctx]
  );

  useEffect(() => {
    if (!handlers) {
      return;
    }
    return register(handlers);
  }, [register, handlers]);

  return register;
};

function useOnKeyUpdate<T>(
  req: ProxyRequest<T> | undefined,
  handler: (req: ProxyRequest<T>) => void
) {
  const prevKey = useRef<string | undefined>();

  useEffect(() => {
    if (!req) {
      return;
    }

    const nextKey = getKey(req);
    if (prevKey.current !== nextKey) {
      handler(req);
      prevKey.current = nextKey;
    }
  }, [req, handler]);
}

const HydrateContext = createContext(new Map<string, unknown>());
const SymbolContext = createContext(new Map<string, symbol>());

export function Hydrate({
  data,
  children,
}: {
  data: Map<string, unknown>;
  children: React.ReactNode;
}) {
  return (
    <SymbolContext.Provider value={useMemo(() => new Map<string, symbol>(), [])}>
      <HydrateContext.Provider value={data}>{children}</HydrateContext.Provider>
    </SymbolContext.Provider>
  );
}

export function useStore<T>(req: ProxyRequest<T>, invokers?: Invokers): T;
export function useStore<T>(req: ProxyRequest<T> | undefined, invokers?: Invokers): T | undefined;
export function useStore<T>(req: ProxyRequest<T> | undefined, invokers?: Invokers) {
  const { query } = invokers ?? useContext(InvokersContext);
  const hydrateData = useContext(HydrateContext);
  const symbolRecord = useContext(SymbolContext);

  const effect = useRef<ReactiveExtended<void>>();
  if (!effect.current) {
    effect.current = new ReactiveExtended(() => {}, true);
  }

  useEffect(() => {
    return () => {
      effect.current?.dispose();
      effect.current = undefined;
    };
  }, []);

  const subscribe = useRef<() => void>();

  const onKeyUpdate = useCallback(
    (req: ProxyRequest<T>) => {
      effect.current?.set(() => {
        // subscribe
        query(req);
        // invalidate
        // will invalidate too often (e.g. on initialization) but uses cache underneath
        subscribe.current?.();
      });
    },
    [query]
  );

  useOnKeyUpdate(req, onKeyUpdate);

  const subscription = useCallback((sub: () => void) => {
    subscribe.current = sub;
    return () => {
      subscribe.current = undefined;
    };
  }, []);

  return useSyncExternalStore(
    subscription,
    () => (req ? query(req) : undefined),
    () => {
      if (!req) {
        return undefined;
      }
      const key = getKey(req, symbolRecord);
      const prev = hydrateData.get(key);
      if (prev !== undefined) {
        return prev as T;
      }
      const result = query(req);
      hydrateData.set(key, result);
      return result;
    }
  );
}

export function useQuery<T>(req: ProxyRequest<Promise<T>>): UseQueryResult<T>;
export function useQuery<T>(
  req: ProxyRequest<Promise<T>> | undefined
): UseQueryResult<T | undefined>;
export function useQuery<T>(req: ProxyRequest<Promise<T>> | undefined) {
  const queryClient = useQueryClient();
  const invokers = useContext(InvokersContext);

  const effect = useRef<ReactiveExtended<void>>();
  if (!effect.current) {
    effect.current = new ReactiveExtended(() => {}, true);
  }

  useEffect(() => {
    return () => {
      effect.current?.dispose();
      effect.current = undefined;
    };
  }, []);

  const onKeyUpdate = useCallback(
    (req: ProxyRequest<Promise<T>>) => {
      effect.current?.set(() => {
        // subscribe
        invokers.query(req);
        // invalidate
        // will invalidate too often (e.g. on initialization) but uses cache underneath
        queryClient.invalidateQueries({
          queryKey: [...req.type, ...req.payload],
          exact: true,
        });
      });
    },
    [queryClient, invokers]
  );

  useOnKeyUpdate(req, onKeyUpdate);

  return useQueryBase({
    queryKey: req ? [...req.type, ...req.payload] : [],
    queryFn: req ? () => invokers.query(req) : skipToken,
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  });
}

export function useInject<T extends string | symbol>(prefix: T): Inject[T];
export function useInject<T extends object>(prefix: string | symbol): T;
export function useInject<T extends string | symbol | HandlerRecord>(prefix: string | symbol) {
  const handlers = useContext(HandlersContext);

  const injectable = useMemo(() => {
    const path = [prefix];

    const result = handlers.first(path);

    if (!result) {
      throw new Error(`No injectable found for: ${path.toString()}`);
    }

    return result;
  }, [prefix]);

  return injectable;
}
