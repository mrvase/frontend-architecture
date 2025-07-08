import { defineMiddleware, sequence } from "astro:middleware";
import { dehydrateQueryClientMiddleware } from "@nanokit/proxy-astro";
import { createContext } from "@nanokit/context";
import type { GlobalAsyncContext } from "./shared/core/context/types";
import { getGlobalContext } from "#context";
import { QueryClient } from "@tanstack/react-query";

export const globalContext = defineMiddleware((ctx, next) => {
  const globalCtx = createContext<GlobalAsyncContext>("global", {
    environment: "server",
    hydrateData: new Map(),
    queryClient: new QueryClient(),
  });

  return globalCtx(() => next());
});

export const onRequest = sequence(
  globalContext,
  dehydrateQueryClientMiddleware(() => getGlobalContext().hydrateData)
);
