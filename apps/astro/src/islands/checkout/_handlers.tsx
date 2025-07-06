import {
  createHandlers,
  createInjectables,
  createIntegrations,
  createInterceptors,
} from "src/features/checkout/infrastructure/handlers";
import { create } from "../handler-util";

export const { cache, handlers, interceptors, dispatchIntegrationEvent } =
  create({
    injectables: createInjectables(),
    handlers: createHandlers(),
    integrations: createIntegrations(),
    interceptors: createInterceptors(),
  });
