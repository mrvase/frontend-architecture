import { AsyncLocalStorage } from "node:async_hooks";

const contexts = new Map();

export function createContext(name, value) {
  let ctx = contexts.get(name);
  if (!ctx) {
    ctx = new AsyncLocalStorage();
    contexts.set(name, ctx);
  }
  return (func) => ctx.run(value, () => func());
}

export function getContext(name) {
  const ctx = contexts.get(name);
  return ctx?.getStore();
}
