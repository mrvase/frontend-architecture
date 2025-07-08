import { it, expect, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type InferHandlers, Inject } from "@nanokit/proxy";
import {
  createRepository,
  type Repository,
} from "@nanokit/proxy-patterns/repository";
import { createSignalCache, signalPlugin } from "../src";
import { HandlersProvider, useQuery, useStore } from "../src/react";
import { client } from "@nanokit/proxy-patterns/client";

beforeEach(() => {
  cleanup();
});

const StringSync = "SyncQueries";
const StringAsync = "AsyncQueries";
const Derived = "Derived";
const Repository = "Repository";
const Client = "Client";

function proxy<T extends keyof Handlers>(key: T) {
  return Inject.proxy<Handlers>()[key];
}
function inject<T extends keyof Injectables>(key: T) {
  return Inject<Injectables[T]>(key);
}

const createClient = (data = { value: 0 }) => ({
  getValue: async () => {
    await new Promise((res) => setTimeout(() => res(undefined), 10));
    console.log("GET CLIENT VALUE", data.value);
    return data.value;
  },
  setValue: async (value: number) => {
    await new Promise((res) => setTimeout(() => res(undefined), 10));
    console.log("SET CLIENT VALUE", value);
    data.value = value;
  },
  [Inject.cache]: createSignalCache(),
});

const syncStringHandlers = {
  getString: () => {
    const repository = inject(Repository);
    return repository.get("") ?? "hello";
  },
  setString: (value: string) => {
    const repository = inject(Repository);
    return repository.set("", value);
  },
  getStringAsync: async () => {
    const repository = inject(Repository);
    await new Promise((res) => setTimeout(() => res(undefined), 10));
    return repository.get("") ?? "hello";
  },
};

const asyncStringHandlers = {
  getString: async () => {
    const client = inject(Client);
    console.log("RERUN 2");
    return { 0: "hello", 1: "world" }[(await client.getValue()) as 0 | 1];
  },
  setString: (value: string) => {
    const client = inject(Client);
    return client.setValue(
      {
        hello: 0,
        world: 1,
      }[value as "hello" | "world"]
    );
  },
};

const derivedHandlers = {
  sync: {
    getDerived: () => {
      const string = proxy(StringSync);
      return Inject.query(string.getString()) + " derived";
    },
  },
  async: {
    getDerived: async () => {
      const client = inject(Client);
      const string = proxy(StringAsync);

      await new Promise((res) => setTimeout(() => res(undefined), 10));
      return (
        (await Inject.query(string.getString())) +
        " derived " +
        (await client.getValue())
      );
    },
  },
};

const createInjectables = () => ({
  [Repository]: createRepository<Repository<string, string>>(signalPlugin()),
  [Client]: client(createClient()),
});

const createHandlers = () => ({
  [StringSync]: syncStringHandlers,
  [StringAsync]: asyncStringHandlers,
  [Derived]: derivedHandlers,
  [Inject.private]: createInjectables(),
  [Inject.cache]: createSignalCache(),
});

type Injectables = ReturnType<typeof createInjectables>;
type Handlers = ReturnType<typeof createHandlers>;

const stringSync = proxy(StringSync);
const stringAsync = proxy(StringAsync);
const derived = proxy(Derived);

it("updates with sync signals", async () => {
  const { query, mutate } = Inject.createInvokers(createHandlers());

  const req = stringSync.getString();

  expect(query(req)).toBe("hello");
  expect(query(derived.sync.getDerived())).toBe("hello derived");

  mutate(stringSync.setString("world"));

  expect(query(req)).toBe("world");
  expect(query(derived.sync.getDerived())).toBe("world derived");
});

it("updates with async signals", async () => {
  const { query, mutate } = Inject.createInvokers(createHandlers());

  const req = stringSync.getStringAsync();

  expect(await query(req)).toBe("hello");

  mutate(stringSync.setString("world"));

  expect(await query(req)).toBe("world");
});

it("updates with async invalidation", async () => {
  const { query, mutate } = Inject.createInvokers(createHandlers());

  const req = stringAsync.getString();

  expect(await query(req)).toBe("hello");
  expect(await query(derived.async.getDerived())).toBe("hello derived 0");

  await mutate(stringAsync.setString("world"));

  expect(await query(req)).toBe("world");
  expect(await query(derived.async.getDerived())).toBe("world derived 1");
});

const ComponentSync = () => {
  const value = useStore(stringSync.getString());

  return <div>{value}</div>;
};

const ComponentAsync = () => {
  const { data: value } = useQuery(stringAsync.getString());

  return <div>{value}</div>;
};

it("Sync component", async () => {
  const handlers = createHandlers();
  const { mutate } = Inject.createInvokers(handlers);

  render(
    <HandlersProvider handlers={handlers}>
      <ComponentSync />
    </HandlersProvider>
  );

  expect(screen.getByText("hello")).toBeInTheDocument();

  mutate(stringSync.setString("world"));

  await screen.findByText("world");

  expect(screen.getByText("world")).toBeInTheDocument();
});

it("Async component", async () => {
  const handlers = createHandlers();
  const { mutate } = Inject.createInvokers(handlers);

  render(
    <QueryClientProvider client={new QueryClient()}>
      <HandlersProvider handlers={handlers}>
        <ComponentAsync />
      </HandlersProvider>
    </QueryClientProvider>
  );

  await screen.findByText("hello");

  expect(screen.getByText("hello")).toBeInTheDocument();

  await mutate(stringAsync.setString("world"));

  await screen.findByText("world");

  expect(screen.getByText("world")).toBeInTheDocument();
});
