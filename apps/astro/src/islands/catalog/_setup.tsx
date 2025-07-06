import { useMemo } from "react";
import type { Texts } from "src/features/catalog/infrastructure/texts";
import type { Routes } from "src/features/catalog/infrastructure/routes";
import {
  CacheProvider,
  DependenciesProvider,
} from "@nanokit/proxy-signals/react";
import { createInterceptorStore } from "@nanokit/proxy";
import { interceptors as cartInterceptors } from "../cart/_handlers";
import { cache, handlers } from "./_handlers";

const interceptors = createInterceptorStore();
interceptors.register(cartInterceptors);

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
