import { Inject } from "@nanokit/proxy";
import { describe, expect, it } from "vitest";
import { createSignalCache } from "../src";
import { client } from "@nanokit/proxy-patterns/client";

function proxy<T extends keyof Inject.InferHandlers<Handlers>>(key: T) {
  return Inject.proxy<Handlers>()[key];
}
function inject<T extends keyof Injectables>(key: T) {
  return Inject.inject<Injectables>()[key];
}

const Client1 = "Client1";
const Client2 = "Client2";

const createClient1 = (state: { value: number }, counter?: { value: number }) => ({
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
  [Inject.cache]: createSignalCache(),
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
  [Inject.cache]: createSignalCache(),
});

const WrapperClient = "WrapperClient";

const wrapperClient = {
  getCount: () => {
    const client = inject(Client1);
    const value = client.getCount();
    return value;
  },
  increment: async () => {
    const client = inject(Client1);
    await client.increment();
  },
};

const createInjectables = (counter?: { value: number }) => ({
  [Client1]: client(createClient1({ value: 0 }, counter)),
  [Client2]: client(createClient2({ value: 0 })),
});

const createHandlers = (counter?: { value: number }) => {
  const injectables = createInjectables(counter);
  return {
    [WrapperClient]: wrapperClient,
    ...injectables,
    [Inject.internal]: injectables,
    [Inject.cache]: createSignalCache(),
  };
};

type Injectables = ReturnType<typeof createInjectables>;
type Handlers = ReturnType<typeof createHandlers>;

describe("auto-invalidates", () => {
  it("gets correct initialState", async () => {
    const handlers = createHandlers();
    const invokers = Inject.createInvokers(handlers);

    const client = proxy(Client1);

    expect(await invokers.query(client.getCount())).toBe(0);
  });

  it("increments after mutation", async () => {
    const handlers = createHandlers();
    const invokers = Inject.createInvokers(handlers);

    const client = proxy(Client1);

    await invokers.mutate(client.increment());

    expect(await invokers.query(client.getCount())).toBe(1);
  });

  it("is cached correctly", async () => {
    const counter = { value: 0 };
    const handlers = createHandlers(counter);
    const invokers = Inject.createInvokers(handlers);

    const client = proxy(Client1);

    expect(await invokers.query(client.getCount())).toBe(0);

    expect(counter.value).toBe(1);

    await invokers.mutate(client.increment());
    invokers.invalidate(Client1);

    expect(await invokers.query(client.getCount())).toBe(1);

    expect(counter.value).toBe(2);
  });

  it("is cached correctly when wrapped", async () => {
    const counter = { value: 0 };
    const handlers = createHandlers(counter);
    const invokers = Inject.createInvokers(handlers);
    const wrapper = proxy(WrapperClient);

    expect(await invokers.query(wrapper.getCount())).toBe(0);
    expect(counter.value).toBe(1);

    await Inject.transaction(() => {
      invokers.dispatch(wrapper.increment());
    });

    expect(await invokers.query(wrapper.getCount())).toBe(1);
    expect(counter.value).toBe(2);
  });

  it("is unaffected by invalidation of unrelated client", async () => {
    const counter = { value: 0 };
    const handlers = createHandlers(counter);
    const invokers = Inject.createInvokers(handlers);
    const wrapper = proxy(WrapperClient);
    const client2 = proxy(Client2);

    expect(await invokers.query(wrapper.getCount())).toBe(0);

    expect(counter.value).toBe(1);

    await Inject.transaction(() => invokers.dispatch(client2.increment()));

    expect(counter.value).toBe(1);
  });

  it("increments after multiple subsequent mutations", async () => {
    const handlers = createHandlers();
    const invokers = Inject.createInvokers(handlers);
    const client1 = proxy(Client1);
    const wrapper = proxy(WrapperClient);

    await Inject.transaction(() => invokers.dispatch(client1.increment()));
    await Inject.transaction(() => invokers.dispatch(client1.increment()));
    await Inject.transaction(() => invokers.dispatch(client1.increment()));

    expect(await invokers.query(wrapper.getCount())).toBe(3);
  });
});
