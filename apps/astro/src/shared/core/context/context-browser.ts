import type { GlobalContext } from "./types";
import { QueryClient } from "@tanstack/react-query";

export function getGlobalContext(): GlobalContext {
  return {
    queryClient: new QueryClient(),
    hydrateData: new Map(),
    environment: "client",
  };
}
