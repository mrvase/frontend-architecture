import {
  useQueryClient,
  useQuery as useQueryBase,
  useMutationState as useMutationStateBase,
  skipToken,
  type UseQueryResult,
  type MutationOptions,
  type MutationState,
  type UseQueryOptions,
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
  createInvokers,
  invokers,
  type Invokers,
  type ProxyRequest,
  type HandlerNode,
  type HandlerRecord,
  ProxySymbol,
  type RequestValue,
  type JsonValue,
} from "@nanokit/proxy";
import { ReactiveExtended } from "./signals/signals-extended";
import { getKey } from "./utils";
import { createSignalCache } from "./cache";

const globalHandlers = [] as HandlerNode[];

const InvokersContext = createContext<Invokers>(invokers);
const HandlersContext = createContext<HandlerNode>(globalHandlers);

export function HandlersProvider({
  handlers,
  children,
}: {
  handlers: HandlerNode;
  children: React.ReactNode;
}) {
  const parentHandlers = useContext(HandlersContext);

  const nextHandlers = useMemo(() => {
    // we want the new handlers to be found first so that inner contexts
    // are prioritized over outer contexts
    return [handlers, parentHandlers];
  }, [handlers, parentHandlers]);

  const invokers = useMemo(() => createInvokers(nextHandlers), [nextHandlers]);

  return (
    <HandlersContext.Provider value={nextHandlers}>
      <InvokersContext.Provider value={invokers}>{children}</InvokersContext.Provider>
    </HandlersContext.Provider>
  );
}

export function StoreProvider({
  handlers,
  children,
}: {
  handlers: HandlerRecord;
  children: React.ReactNode;
}) {
  const parentHandlers = useContext(HandlersContext);

  const store = useMemo(() => {
    return {
      ...handlers,
      [ProxySymbol.cache]: handlers[ProxySymbol.cache] ?? createSignalCache(),
    };
  }, [handlers]);

  const nextHandlers = useMemo(() => {
    return [store, parentHandlers];
  }, [handlers, parentHandlers]);

  const invokers = useMemo(() => createInvokers(nextHandlers), [nextHandlers]);

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
  useEffect(() => {
    if (!handlers) {
      return;
    }

    globalHandlers.push(handlers);

    return () => {
      const index = globalHandlers.indexOf(handlers);
      if (index !== -1) {
        globalHandlers[index] = globalHandlers[globalHandlers.length - 1];
        globalHandlers.pop();
      }
    };
  }, [handlers]);

  return null;
};

function useOnKeyUpdate<T extends RequestValue>(
  req: ProxyRequest<T> | undefined,
  handler: (req: ProxyRequest<T>) => void,
  invokers?: Invokers
) {
  const { query } = invokers ?? useContext(InvokersContext);

  const prevKey = useRef<string | undefined>();

  const effect = useRef<ReactiveExtended<void>>();
  if (!effect.current) {
    effect.current = new ReactiveExtended(() => {}, true);
  }

  const onKeyUpdate = useCallback(
    (req: ProxyRequest<T>) => {
      effect.current?.set(() => {
        // subscribe
        query(req);
        // invalidate
        // will invalidate too often (e.g. on initialization) but uses cache underneath
        handler(req);
      });
    },
    [handler]
  );

  useEffect(() => {
    return () => {
      effect.current?.dispose();
      effect.current = undefined;
    };
  }, []);

  useEffect(() => {
    if (!req) {
      return;
    }

    const nextKey = getKey(req);
    if (prevKey.current !== nextKey) {
      onKeyUpdate(req);
      prevKey.current = nextKey;
    }
  }, [req, onKeyUpdate]);
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

export function useStore<T extends RequestValue>(req: ProxyRequest<T>, invokers?: Invokers): T;
export function useStore<T extends RequestValue>(
  req: ProxyRequest<T> | undefined,
  invokers?: Invokers
): T | undefined;
export function useStore<T extends RequestValue>(
  req: ProxyRequest<T> | undefined,
  invokers?: Invokers
) {
  const { query } = invokers ?? useContext(InvokersContext);
  const hydrateData = useContext(HydrateContext);
  const symbolRecord = useContext(SymbolContext);

  const subscribe = useRef<() => void>();

  const onKeyUpdate = useCallback((req: ProxyRequest<T>) => {
    subscribe.current?.();
  }, []);

  useOnKeyUpdate(req, onKeyUpdate, invokers);

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

export function useQuery<T extends JsonValue>(
  req: ProxyRequest<Promise<T>>,
  options?: Omit<UseQueryOptions<T>, "queryKey" | "queryFn" | "queryHash" | "queryKeyHashFn">
): UseQueryResult<T>;
export function useQuery<T extends JsonValue>(
  req: ProxyRequest<Promise<T>> | undefined,
  options?: Omit<UseQueryOptions<T>, "queryKey" | "queryFn" | "queryHash" | "queryKeyHashFn">
): UseQueryResult<T | undefined>;
export function useQuery<T extends JsonValue>(
  req: ProxyRequest<Promise<T>> | undefined,
  options?: Omit<UseQueryOptions<T>, "queryKey" | "queryFn" | "queryHash" | "queryKeyHashFn">
) {
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
      // invalidate
      // will invalidate too often (e.g. on initialization) but uses cache underneath
      queryClient.invalidateQueries({
        queryKey: [...req.type, ...req.payload],
        exact: true,
      });
    },
    [queryClient, invokers]
  );

  useOnKeyUpdate(req, onKeyUpdate, invokers);

  return useQueryBase({
    queryKey: req ? [...req.type, ...req.payload] : [],
    queryFn: req ? () => invokers.query(req) : skipToken,
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    ...options,
  });
}
