import { it, expect } from "vitest";
import "@testing-library/jest-dom/vitest";
import { proxy, ProxySymbol, query } from "@nanokit/proxy";
import { createSignalCache } from "../src";
import { HandlersProvider, StoreProvider, useStore } from "../src/react";
import { render, screen } from "@testing-library/react";

const Outer = "Outer";
const Store = "Store";

const cacheOuter = createSignalCache();
const cacheStore = createSignalCache();

const outerHandlers = {
  [Outer]: {
    getValue: () => "hello",
  },
  [ProxySymbol.cache]: cacheOuter,
};

const handlers = {
  [Store]: {
    // query from another cache
    getValuePrivate: () => query(outer.getValue()),
    // query itself
    getValue: () => query(store.getValuePrivate()).split(" ")[0],
  },
  [ProxySymbol.cache]: cacheStore,
};

const outer = proxy<typeof outerHandlers>()[Outer];
const store = proxy<typeof handlers>()[Store];

function Component() {
  const value = useStore(store.getValue());

  return <div>{value}</div>;
}

it("Component", async () => {
  render(
    <HandlersProvider handlers={outerHandlers}>
      <StoreProvider handlers={handlers}>
        <Component />
      </StoreProvider>
    </HandlersProvider>
  );

  expect(screen.getByText("hello")).toBeInTheDocument();

  expect(cacheOuter.getCachedData?.(outer.getValue())).toBeDefined();
  expect(cacheOuter.getCachedData?.(store.getValue())).toBeUndefined();
  expect(cacheStore.getCachedData?.(store.getValue())).toBeDefined();
  expect(cacheStore.getCachedData?.(outer.getValue())).toBeUndefined();
});
