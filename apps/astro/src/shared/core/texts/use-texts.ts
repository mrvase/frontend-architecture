import type { Inject } from "@nanokit/proxy";
import { useInvokers } from "@nanokit/proxy-signals/react";
import { createProxy } from "@nanokit/proxy/internal";

export function useTexts(): Inject.Handlers["t"] {
  const { query } = useInvokers();

  return createProxy((request) =>
    query({ ...request, type: ["t", ...request.type] })
  ) as Inject.Handlers["t"];
}
