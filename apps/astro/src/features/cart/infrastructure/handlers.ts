import { cartQueries } from "../application/cart-queries";

export const createHandlers = () => {
  return {
    cartQueries,
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
