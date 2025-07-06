import { checkoutQueries } from "../application/checkout-queries";

export const createHandlers = () => {
  return {
    checkoutQueries,
  };
};

type LocalHandlers = ReturnType<typeof createHandlers>;

declare module "@nanokit/proxy" {
  interface Proxy extends LocalHandlers {}
}

export const createInjectables = () => {
  return {};
};

type LocalInjectables = ReturnType<typeof createInjectables>;

declare module "@nanokit/proxy" {
  interface Inject extends LocalInjectables {}
}

export const createIntegrations = () => {
  return {};
};

export const createInterceptors = () => {
  return {};
};
