import { AsyncLocalStorage } from "node:async_hooks";

const contexts = new Map();

export function createContext(name: string, value: unknown) {
  let ctx = contexts.get(name);
  if (!ctx) {
    ctx = new AsyncLocalStorage();
    contexts.set(name, ctx);
  }
  return <U,>(func: () => U) => ctx.run(value, () => func());
}

export function getContext(name: string) {
  const ctx = contexts.get(name);
  return ctx?.getStore();
}
