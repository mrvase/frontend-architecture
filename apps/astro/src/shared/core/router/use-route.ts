import type { Inject } from "@nanokit/proxy";
import { useInvokers } from "@nanokit/proxy-signals/react";
import { createProxy } from "@nanokit/proxy/internal";

export function useRoutes(): Inject.Handlers["routes"] {
  const { query } = useInvokers();

  return createProxy((request) =>
    query({ ...request, type: ["routes", ...request.type] })
  ) as Inject.Handlers["routes"];
}
