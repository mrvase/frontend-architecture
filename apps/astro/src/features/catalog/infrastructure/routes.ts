import type { Href, RoutesProxy } from "src/shared/core/router/routes-proxy";

export type Routes = {
  checkout: Href;
  product: Href<{ productId: string | number }>;
};

declare module "@nanokit/proxy" {
  interface Handlers extends RoutesProxy<Routes> {}
}
