import { it, expect } from "vitest";
import "@testing-library/jest-dom/vitest";
import { Inject } from "@nanokit/proxy";
import { StoreProvider, useMutate, useStore } from "../src/react";
import { fireEvent, render, screen } from "@testing-library/react";
import { signalPlugin } from "../src";
import { createSingleton, type Singleton } from "@nanokit/proxy-patterns/singleton";

const Store = "Store";

const state = createSingleton<Singleton<string>>(signalPlugin(), (map) => map.set(null, "hello"));

const handlers = {
  [Store]: {
    getValue: () => state.get(),
    setValue: (value: string) => state.set(value),
  },
};

const store = Inject.proxy<typeof handlers>()[Store];

function Component() {
  const value = useStore(store.getValue());
  const mutate = useMutate();

  return (
    <div>
      {value}
      <button onClick={() => mutate(store.setValue("world"))}>Click me!</button>
    </div>
  );
}

it("Component", async () => {
  render(
    <StoreProvider handlers={handlers}>
      <Component />
    </StoreProvider>
  );

  expect(await screen.findByText("hello")).toBeInTheDocument();

  fireEvent.click(screen.getByText("Click me!"));

  expect(await screen.findByText("world")).toBeInTheDocument();
});
