import { createSignalCache } from "@nanokit/proxy-signals";
import { catalogQueries } from "../application/catalog-queries";
import {
  Proxy,
  type HandlerNode,
  type InjectableRecord,
  type InferProxy,
} from "src/core/proxy";

const cache = createSignalCache();

const injectables = {} as const satisfies InjectableRecord;

type LocalInjectables = typeof injectables;

declare module "@nanokit/proxy" {
  interface Inject extends LocalInjectables {}
}

const domainEvents = {
  cartDomainEvents: {},
};

export const handlers = {
  catalogQueries: [catalogQueries, () => {}],
  catalogIntegrationQueries: {},
  [Proxy.private]: [injectables, domainEvents],
  [Proxy.cache]: cache,
} as const satisfies HandlerNode;

type ProxyHandlers = InferProxy<typeof handlers>;

declare module "@nanokit/proxy" {
  interface Proxy extends ProxyHandlers {}
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
  [Proxy.private]: handlers,
  [Proxy.cache]: cache,
} as const satisfies HandlerNode;

// this is imported by another module
export const cartInterceptors = {
  cartIntegrationQueries: {},
  [Proxy.private]: handlers,
  [Proxy.cache]: cache,
} as const satisfies HandlerNode;

// this is imported by another module
export const checkoutInterceptors = {
  checkoutIntegrationQueries: {},
  [Proxy.private]: handlers,
  [Proxy.cache]: cache,
} as const satisfies HandlerNode;
