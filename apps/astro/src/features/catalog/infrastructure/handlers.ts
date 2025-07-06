import { createSignalCache } from "@nanokit/proxy-signals";
import { catalogQueries } from "../application/catalog-queries";
import {
  Inject,
  proxy,
  type HandlerNode,
  type InjectableRecord,
  type ToProxy,
} from "@nanokit/proxy";

const cache = createSignalCache();

const injectables = {} as const satisfies InjectableRecord;

type LocalInjectables = typeof injectables;

declare module "@nanokit/proxy" {
  interface Injectables extends LocalInjectables {}
}

const domainEvents = {
  cartDomainEvents: {},
};

export const handlers = {
  catalogQueries: [catalogQueries, () => {}],
  catalogIntegrationQueries: {},
  [Inject.private]: [injectables, domainEvents],
  [Inject.cache]: cache,
} as const satisfies HandlerNode;

type ProxyHandlers = ToProxy<typeof handlers, never>;

declare module "@nanokit/proxy" {
  interface Handlers extends ProxyHandlers {}
}

// integration events others have defined (in /integration)
// these are dispatched by this module
// therefore we need their handlers to be provided
export type ConsumedIntegrations = {
  cartIntegrationEvents: {};
  checkoutIntegrationEvents: {};
};

// interceptors I have defined (in /interceptors)
export type ConsumedInterceptors = {
  catalogIntegrationQueries: {};
};

// this is imported by other modules
export const integrationEvents = {
  catalogIntegrationEvents: {},
  [Inject.private]: handlers,
  [Inject.cache]: cache,
} as const satisfies HandlerNode;

// this is imported by another module
export const cartInterceptors = {
  cartIntegrationQueries: {},
  [Inject.private]: handlers,
  [Inject.cache]: cache,
} as const satisfies HandlerNode;

// this is imported by another module
export const checkoutInterceptors = {
  checkoutIntegrationQueries: {},
  [Inject.private]: handlers,
  [Inject.cache]: cache,
} as const satisfies HandlerNode;
