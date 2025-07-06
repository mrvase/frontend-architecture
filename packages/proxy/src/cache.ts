import type { ProxyRequestCache } from "./types";

export const defaultCache: ProxyRequestCache = {
  query: (_, invoke) => {
    return invoke();
  },
  mutate: (_, invoke) => {
    return invoke();
  },
  dispatch: async (_, invoke) => {
    invoke();
  },
  invalidate: () => {},
  set: () => {},
};
