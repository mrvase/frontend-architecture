import { it, expect } from "vitest";
import "@testing-library/jest-dom/vitest";
import { createHandlerStore, proxy, query } from "@nanokit/proxy";
import { createSignalCache } from "../src";
import {
  CacheProvider,
  DependenciesProvider,
  StoreProvider,
  useStore,
} from "../src/react";
import { render, screen } from "@testing-library/react";

const Outer = Symbol("Outer");
const Store = Symbol("Store");

const outerHandlers = {
  [Outer]: {
    getValue: () => "hello",
  },
};

const handlers = {
  [Store]: {
    // query from another cache
    getValuePrivate: () => query(outer.getValue()),
    // query itself
    getValue: () => query(store.getValuePrivate()).split(" ")[0],
  },
};

const outer = proxy<typeof outerHandlers>()[Outer];
const store = proxy<typeof handlers>()[Store];

function Component() {
  const value = useStore(store.getValue());

  return <div>{value}</div>;
}

it("Component", async () => {
  const cacheOuter = createSignalCache();
  const cacheStore = createSignalCache();
  const handlerStore = createHandlerStore();
  handlerStore.register(outerHandlers);

  render(
    <CacheProvider cache={cacheOuter}>
      <DependenciesProvider handlers={handlerStore}>
        <StoreProvider handlers={handlers} cache={cacheStore}>
          <Component />
        </StoreProvider>
      </DependenciesProvider>
    </CacheProvider>
  );

  expect(screen.getByText("hello")).toBeInTheDocument();

  expect(cacheOuter.getCachedData?.(outer.getValue())).toBeDefined();
  expect(cacheOuter.getCachedData?.(store.getValue())).toBeUndefined();
  expect(cacheStore.getCachedData?.(store.getValue())).toBeDefined();
  expect(cacheStore.getCachedData?.(outer.getValue())).toBeUndefined();
});
