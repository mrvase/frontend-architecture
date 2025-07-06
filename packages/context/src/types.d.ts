export declare function getContext<T extends { name: string; value: unknown }>(
  name: T["name"]
): T["value"] | undefined;
export declare function createContext<
  T extends { name: string; value: unknown },
>(name: T["name"], value: T["value"]): <U>(func: () => U) => U;
