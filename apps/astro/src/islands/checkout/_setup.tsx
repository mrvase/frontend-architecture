import { useMemo } from "react";
import type { Texts } from "src/features/checkout/infrastructure/texts";
import type { Routes } from "src/features/checkout/infrastructure/routes";
import {
  CacheProvider,
  DependenciesProvider,
} from "@nanokit/proxy-signals/react";
import { cache, handlers } from "./_handlers";
import { createInterceptorStore } from "@nanokit/proxy";

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

export function createIsland<T>(MyComponent: (props: T) => React.ReactNode) {
  return (props: T) => {
    const texts = useMemo(() => createTexts(), []);
    const routes = useMemo(() => createRoutes(), []);

    return (
      <CacheProvider cache={cache}>
        <DependenciesProvider handlers={handlers} interceptors={interceptors}>
          <MyComponent {...(props as JSX.IntrinsicAttributes & T)} />
        </DependenciesProvider>
      </CacheProvider>
    );
  };
}

type RouteDef<T extends Record<string, void | object>> = {
  [K in keyof T]: string | ((props: T[K]) => string);
};
