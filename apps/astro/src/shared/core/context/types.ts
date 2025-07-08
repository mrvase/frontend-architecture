import type { QueryClient } from "@tanstack/react-query";

export type GlobalContext = {
  queryClient: QueryClient;
  hydrateData: Map<string, unknown>;
  environment: "server" | "client";
};

export type GlobalAsyncContext = {
  name: "global";
  value: GlobalContext;
};
