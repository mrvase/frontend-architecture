import { it, expect, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  proxy as proxy_,
  inject as inject_,
  createInvokers,
  query,
  createHandlerStore,
  createInterceptorStore,
} from "@nanokit/proxy";
import { createRepository } from "@nanokit/proxy-patterns/repository";
import { createSignalCache, signalPlugin } from "../src";
import {
  CacheProvider,
  DependenciesProvider,
  useQuery,
  useStore,
} from "../src/react";
import { client } from "@nanokit/proxy-patterns/client";

beforeEach(() => {
  cleanup();
});

const StringSync = Symbol("SyncQueries");
const StringAsync = Symbol("AsyncQueries");
const Repository = Symbol("Repository");
const Client = Symbol("Client");

function proxy<T extends keyof Handlers>(key: T) {
  return proxy_<Handlers>()[key];
}
function inject<T extends keyof Handlers>(key: T) {
  return inject_<Handlers[T]>(key);
}

const createClient = (data = { value: 0 }) => ({
  getValue: async () => {
    await new Promise((res) => setTimeout(() => res(undefined), 10));
    console.log("GET CLIENT VALUE", data.value);
    return data.value;
  },
  setValue: async (value: number) => {
    await new Promise((res) => setTimeout(() => res(undefined), 10));
    data.value = value;
  },
});

const stringHandlers = {
  [StringSync]: {
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
  },

  [StringAsync]: {
    getString: async () => {
      const client = inject(Client);
      console.log("RERUN 2");
      await new Promise((res) => setTimeout(() => res(undefined), 10));
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
  },
};

const stringInterceptors = {
  [StringSync]: {
    getString(value: string) {
      return value + " intercepted";
    },
  },
};

const derivedHandlers = {
  derived: {
    sync: {
      getDerived: () => {
        const string = proxy(StringSync);
        return query(string.getString()) + " derived";
      },
    },
    async: {
      getDerived: async () => {
        const client = inject(Client);
        const string = proxy(StringAsync);

        await new Promise((res) => setTimeout(() => res(undefined), 10));
        return (
          (await query(string.getString())) +
          " derived " +
          (await client.getValue())
        );
      },
    },
  },
};

const createHandlers = () => {
  return {
    [Repository]: createRepository(signalPlugin()),
    [Client]: client(createClient()),

    ...stringHandlers,
    ...derivedHandlers,
  };
};

const createInterceptors = () => {
  return {
    ...stringInterceptors,
  };
};

type Handlers = ReturnType<typeof createHandlers>;

const stringSync = proxy(StringSync);
const stringAsync = proxy(StringAsync);
const derived = proxy("derived");

it("updates with sync signals", async () => {
  const handlers = createHandlerStore();
  handlers.register(createHandlers());
  const interceptors = createInterceptorStore();
  interceptors.register(createInterceptors());
  const cache = createSignalCache();
  const { query, mutate } = createInvokers({ handlers, interceptors, cache });

  const req = stringSync.getString();

  expect(query(req)).toBe("hello intercepted");
  expect(query(derived.sync.getDerived())).toBe("hello intercepted derived");

  mutate(stringSync.setString("world"));

  expect(query(req)).toBe("world intercepted");
  expect(query(derived.sync.getDerived())).toBe("world intercepted derived");
});
it("updates with async signals", async () => {
  const handlers = createHandlerStore();
  handlers.register(createHandlers());
  const interceptors = createInterceptorStore();
  interceptors.register(createInterceptors());
  const cache = createSignalCache();
  const { query, mutate } = createInvokers({ handlers, interceptors, cache });

  const req = stringSync.getStringAsync();

  expect(await query(req)).toBe("hello");

  mutate(stringSync.setString("world"));

  expect(await query(req)).toBe("world");
});

it("updates with async invalidation", async () => {
  const handlers = createHandlerStore();
  handlers.register(createHandlers());
  const interceptors = createInterceptorStore();
  interceptors.register(createInterceptors());
  const cache = createSignalCache();
  const { query, mutate } = createInvokers({
    handlers,
    interceptors,
    cache,
  });

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
  const handlers = createHandlerStore();
  handlers.register(createHandlers());
  const interceptors = createInterceptorStore();
  interceptors.register(createInterceptors());
  const cache = createSignalCache();
  const { mutate } = createInvokers({ handlers, interceptors, cache });

  render(
    <CacheProvider cache={cache}>
      <DependenciesProvider handlers={handlers} interceptors={interceptors}>
        <ComponentSync />
      </DependenciesProvider>
    </CacheProvider>
  );

  expect(screen.getByText("hello intercepted")).toBeInTheDocument();

  mutate(stringSync.setString("world"));

  await screen.findByText("world intercepted");

  expect(screen.getByText("world intercepted")).toBeInTheDocument();
});

it("Async component", async () => {
  const handlers = createHandlerStore();
  handlers.register(createHandlers());
  const interceptors = createInterceptorStore();
  interceptors.register(createInterceptors());
  const cache = createSignalCache();
  const { mutate } = createInvokers({
    handlers,
    interceptors,
    cache,
  });

  render(
    <QueryClientProvider client={new QueryClient()}>
      <CacheProvider cache={cache}>
        <DependenciesProvider handlers={handlers} interceptors={interceptors}>
          <ComponentAsync />
        </DependenciesProvider>
      </CacheProvider>
    </QueryClientProvider>
  );

  await screen.findByText("hello");

  expect(screen.getByText("hello")).toBeInTheDocument();

  await mutate(stringAsync.setString("world"));

  await screen.findByText("world");

  expect(screen.getByText("world")).toBeInTheDocument();
});
