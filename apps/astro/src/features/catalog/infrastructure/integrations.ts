import type { CatalogIntegrationEvents } from "../integrations/catalog-integration-events";
import type { CartIntegrationQueries } from "../integrations/cart-integration-queries";
import type { Inject } from "@nanokit/proxy";

// integration events I have defined (in /integration)
// these are dispatched by this module
// therefore we need handlers to be provided from other modules
export type Integrations = {
  [CatalogIntegrationEvents]: CatalogIntegrationEvents;
  [CartIntegrationQueries]: CartIntegrationQueries;
};

declare module "@nanokit/proxy" {
  interface Handlers extends Inject.InferHandlers<Integrations> {}
}
