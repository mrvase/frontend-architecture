import type { Href, RoutesProxy } from "src/shared/core/router/routes-proxy";

export type Routes = {
  checkout: Href;
};

declare module "@nanokit/proxy" {
  interface Handlers extends RoutesProxy<Routes> {}
}
