import type { Handlers } from "@nanokit/proxy";
import { useInvokers } from "@nanokit/proxy-signals/react";
import { createProxy } from "@nanokit/proxy/internal";

export function useTexts(): Handlers["t"] {
  const { query } = useInvokers();

  return createProxy((request) =>
    query({ ...request, type: ["t", ...request.type] })
  ) as Handlers["t"];
}
