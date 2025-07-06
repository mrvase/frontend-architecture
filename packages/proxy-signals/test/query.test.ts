import {
  createHandlerStore,
  createInvokers,
  inject as inject_,
  proxy as proxy_,
  transaction,
} from "@nanokit/proxy";
import { describe, expect, it } from "vitest";
import { createSignalCache } from "../src";
import { client } from "@nanokit/proxy-patterns/client";

function proxy<T extends keyof Handlers>(key: T) {
  return proxy_<Handlers>()[key];
}
function inject<T extends keyof Handlers>(key: T) {
  return inject_<Handlers[T]>(key);
}

const Client1 = Symbol("Client1");
const Client2 = Symbol("Client2");

const createClient1 = (
  state: { value: number },
  counter?: { value: number }
) => ({
  getCount: async () => {
    if (counter) {
      counter.value += 1;
    }
    await new Promise((res) => setTimeout(res, 20));
    return state.value;
  },
  increment: async () => {
    await new Promise((res) => setTimeout(res, 20));
    state.value++;
  },
});

const createClient2 = (state: { value: number }) => ({
  getCount: async () => {
    await new Promise((res) => setTimeout(res, 20));
    return state.value;
  },
  increment: async () => {
    await new Promise((res) => setTimeout(res, 20));
    state.value++;
  },
});

const WrapperClient = Symbol("WrapperClient");

const wrapperClient = {
  [WrapperClient]: {
    getCount: () => {
      const client = inject(Client1);
      const value = client.getCount();
      return value;
    },
    increment: async () => {
      const client = inject(Client1);
      await client.increment();
    },
  },
};

const createHandlers = (counter?: { value: number }) => ({
  [Client1]: client(createClient1({ value: 0 }, counter)),
  [Client2]: client(createClient2({ value: 0 })),
  ...wrapperClient,
});

type Handlers = ReturnType<typeof createHandlers>;

describe("auto-invalidates", () => {
  it("gets correct initialState", async () => {
    const handlers = createHandlerStore();
    handlers.register(createHandlers());
    const invokers = createInvokers({ handlers, cache: createSignalCache() });

    const client = proxy(Client1);

    expect(await invokers.query(client.getCount())).toBe(0);
  });

  it("increments after mutation", async () => {
    const handlers = createHandlerStore();
    handlers.register(createHandlers());
    const invokers = createInvokers({ handlers, cache: createSignalCache() });

    const client = proxy(Client1);

    await invokers.mutate(client.increment());

    expect(await invokers.query(client.getCount())).toBe(1);
  });

  it("is cached correctly", async () => {
    const handlers = createHandlerStore();
    const counter = { value: 0 };
    handlers.register(createHandlers(counter));
    const invokers = createInvokers({ handlers, cache: createSignalCache() });

    const client = proxy(Client1);

    expect(await invokers.query(client.getCount())).toBe(0);

    expect(counter.value).toBe(1);

    await invokers.mutate(client.increment());
    invokers.invalidate(Client1);

    expect(await invokers.query(client.getCount())).toBe(1);

    expect(counter.value).toBe(2);
  });

  it("is cached correctly when wrapped", async () => {
    const handlers = createHandlerStore();
    const counter = { value: 0 };
    handlers.register(createHandlers(counter));
    const invokers = createInvokers({ handlers, cache: createSignalCache() });
    const wrapper = proxy(WrapperClient);

    expect(await invokers.query(wrapper.getCount())).toBe(0);
    expect(counter.value).toBe(1);

    await transaction(() => {
      invokers.dispatch(wrapper.increment());
    });

    expect(await invokers.query(wrapper.getCount())).toBe(1);
    expect(counter.value).toBe(2);
  });

  it("is unaffected by invalidation of unrelated client", async () => {
    const handlers = createHandlerStore();
    const counter = { value: 0 };
    handlers.register(createHandlers(counter));
    const invokers = createInvokers({ handlers, cache: createSignalCache() });
    const wrapper = proxy(WrapperClient);
    const client2 = proxy(Client2);

    expect(await invokers.query(wrapper.getCount())).toBe(0);

    expect(counter.value).toBe(1);

    await invokers.dispatch(client2.increment());

    expect(counter.value).toBe(1);
  });

  it("increments after multiple subsequent mutations", async () => {
    const handlers = createHandlerStore();
    handlers.register(createHandlers());
    const invokers = createInvokers({ handlers, cache: createSignalCache() });
    const client1 = proxy(Client1);
    const wrapper = proxy(WrapperClient);

    await invokers.dispatch(client1.increment());
    await invokers.dispatch(client1.increment());
    await invokers.dispatch(client1.increment());

    expect(await invokers.query(wrapper.getCount())).toBe(3);
  });
});
