import { getContext } from "@nanokit/context";
import type { GlobalAsyncContext, GlobalContext } from "./types";

export const getGlobalContext = (): GlobalContext => {
  const ctx = getContext<GlobalAsyncContext>("global");
  if (!ctx) {
    throw new Error("Global context not found");
  }
  return ctx;
};
