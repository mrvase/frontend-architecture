import {
  createHandlerStore,
  createInterceptorStore,
  createInvokers,
  type HandlerRecord,
} from "@nanokit/proxy";
import { createSignalCache } from "@nanokit/proxy-signals";

export const create = ({
  injectables,
  handlers,
  integrations,
  interceptors,
}: {
  injectables: HandlerRecord;
  handlers: HandlerRecord;
  integrations: HandlerRecord;
  interceptors: HandlerRecord;
}) => {
  const cache = createSignalCache();

  const featureHandlersV2 = {
    privateHandlers: injectables,
    publicHandlers: handlers,
    interceptors,
    cache,
  };

  const integrationHandlersV2 = {
    privateHandlers: [
      ...featureHandlersV2.privateHandlers,
      ...featureHandlersV2.publicHandlers,
    ],
    publicHandlers: integrations,
    interceptors,
    cache,
  };

  const featureHandlersV2 = attach(handlers)
    .addPrivateHandlers(injectables)
    .addInterceptors(interceptors);

  const featureHandlers = createHandlerStore();
  featureHandlers.registerPrivate(injectables);
  featureHandlers.registerPublic(handlers);

  const integrationHandlers = createHandlerStore();
  integrationHandlers.registerPrivate(injectables);
  integrationHandlers.registerPrivate(handlers);
  integrationHandlers.registerPublic(integrations);

  const dispatchIntegrationEvent = createInvokers({
    handlers: integrationHandlers,
    cache,
  }).dispatch;

  const featureInterceptors = createInterceptorStore();
  featureInterceptors.register(interceptors);

  return {
    cache,
    handlers: featureHandlers,
    interceptors: featureInterceptors,
    dispatchIntegrationEvent,
  };
};
