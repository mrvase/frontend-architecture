import { createSignalCache } from "@nanokit/proxy-signals";
import { catalogQueries } from "../application/catalog-queries";
import { Inject } from "@nanokit/proxy";
import { injectables } from "./injectables";

const cache = createSignalCache();

const domainEvents = {
  cartDomainEvents: {},
};

export const handlers = {
  catalogQueries,
  [Inject.internal]: [injectables, domainEvents],
  [Inject.cache]: cache,
} as const satisfies Inject.HandlerRecord;

// this is imported by other modules
export const cartIntegrations = {
  cartIntegrationEvents: {},
  cartIntegrationQueries: {},
  [Inject.internal]: handlers,
  [Inject.cache]: cache,
} as const satisfies Inject.HandlerRecord;

// this is imported by another module
export const checkoutIntegrations = {
  checkoutIntegrationEvents: {},
  checkoutIntegrationQueries: {},
  [Inject.internal]: handlers,
  [Inject.cache]: cache,
} as const satisfies Inject.HandlerRecord;

declare module "@nanokit/proxy" {
  interface Handlers extends Inject.InferHandlers<typeof handlers> {}
}
