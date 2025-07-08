import { createSignalCache } from "@nanokit/proxy-signals";
import { catalogQueries } from "../application/catalog-queries";
import { Inject, type HandlerNode, type InferHandlers } from "@nanokit/proxy";
import { injectables } from "./injectables";

const cache = createSignalCache();

const domainEvents = {
  cartDomainEvents: {},
};

export const handlers = {
  catalogQueries,
  [Inject.private]: [injectables, domainEvents],
  [Inject.cache]: cache,
} as const satisfies HandlerNode;

// this is imported by other modules
export const cartIntegrations = {
  cartIntegrationEvents: {},
  cartIntegrationQueries: {},
  [Inject.private]: handlers,
  [Inject.cache]: cache,
} as const satisfies HandlerNode;

// this is imported by another module
export const checkoutIntegrations = {
  checkoutIntegrationEvents: {},
  checkoutIntegrationQueries: {},
  [Inject.private]: handlers,
  [Inject.cache]: cache,
} as const satisfies HandlerNode;

declare module "@nanokit/proxy" {
  interface Handlers extends InferHandlers<typeof handlers> {}
}
