import type { InferHandlers } from "@nanokit/proxy";

// integration events I have defined (in /integration)
// these are dispatched by this module
// therefore we need handlers to be provided from other modules
export type Integrations = {};

declare module "@nanokit/proxy" {
  interface Handlers extends InferHandlers<Integrations> {}
}
