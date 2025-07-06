import { useMemo } from "react";
import type { Texts } from "src/features/cart/infrastructure/texts";
import type { Routes } from "src/features/cart/infrastructure/routes";
import {
  CacheProvider,
  DependenciesProvider,
} from "@nanokit/proxy-signals/react";
import { cache, handlers } from "./_handlers";
import {
  createInterceptorStore,
  createInvokers,
  type ProxyRequest,
} from "@nanokit/proxy";

const interceptors = createInterceptorStore();

const createTexts = (): Texts => ({
  cartSummary: {},
  form: {
    required: "Required",
  },
});

const createRoutes = (): RouteDef<Routes> => {
  return {
    checkout: "/checkout",
    product: (props) => `/product/${props.productId}`,
  };
};

export function createIsland<T>(
  Island: ((props: T) => React.ReactNode) & { prefetch?: ProxyRequest[] }
) {
  return Object.assign(
    (props: T) => {
      const texts = useMemo(() => createTexts(), []);
      const routes = useMemo(() => createRoutes(), []);

      return (
        <CacheProvider cache={cache}>
          <DependenciesProvider handlers={handlers} interceptors={interceptors}>
            <Island {...(props as JSX.IntrinsicAttributes & T)} />
          </DependenciesProvider>
        </CacheProvider>
      );
    },
    {
      prefetch: Island.prefetch,
      query: createInvokers({ handlers, interceptors, cache }).query,
    }
  );
}

type RouteDef<T extends Record<string, void | object>> = {
  [K in keyof T]: string | ((props: T[K]) => string);
};
