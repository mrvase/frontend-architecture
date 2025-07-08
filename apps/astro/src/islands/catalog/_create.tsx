import { HandlersProvider } from "@nanokit/proxy-signals/react";
import { Inject, type ProxyRequest } from "@nanokit/proxy";
import { handlers } from "src/features/catalog/infrastructure/handlers";
import { texts } from "./_texts";
import { routes } from "./_routes";
import { integrations } from "./_integrations";

const all = [handlers, integrations, texts, routes];

export function createIsland<T>(
  MyComponent: ((props: T) => React.ReactNode) & { prefetch?: ProxyRequest[] }
) {
  return Object.assign(
    (props: T) => {
      return (
        <HandlersProvider handlers={all}>
          <MyComponent {...(props as JSX.IntrinsicAttributes & T)} />
        </HandlersProvider>
      );
    },
    {
      prefetch: MyComponent.prefetch,
      query: Inject.createInvokers(all).query,
    }
  );
}
