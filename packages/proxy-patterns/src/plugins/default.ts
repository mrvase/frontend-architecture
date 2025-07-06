import type { ProxyPayload } from "@nanokit/proxy/internal";
import type { Repository } from "../repository";
import { ProxySymbol } from "@nanokit/proxy";

export const defaultPlugin =
  () =>
  <T extends Repository<any, any>>(map: T): T => {
    type TKey = string;
    type TValue = unknown;

    return {
      get: (key: TKey) => map.get(key),
      set(key: TKey, value: TValue) {
        map.set(key, value);
        return this;
      },
      has: (key: TKey) => map.has(key),
      delete: (key: TKey) => map.delete(key),
      clear: () => map.clear(),
      forEach: (
        callbackfn: (value: TValue, key: TKey, map: Map<TKey, TValue>) => void
      ) => map.forEach(callbackfn),
      entries: () => map.entries(),
      values: () => map.values(),
      keys: () => map.keys(),
      get size() {
        return map.size;
      },
      [Symbol.iterator]() {
        return map[Symbol.iterator]();
      },
      [Symbol.toStringTag]: "Repository",
      [ProxySymbol.onInject]<T>(payload: ProxyPayload<T>) {
        return map[ProxySymbol.onInject]?.(payload) ?? map;
      },
    } satisfies Repository<any, any> as T;
  };

export function createPlugin<TOutput extends Repository<any, any>>(
  cb: (
    map: Repository<any, any>,
    payload?: ProxyPayload
  ) => Omit<Partial<Repository<any, any>>, "set"> & {
    set?: (key: any, value: any) => void;
  }
) {
  const create = (
    map: Repository<any, any>,
    payload?: ProxyPayload
  ): Repository<any, any> => {
    const newMap = defaultPlugin()(map);
    const overrideMap = cb(map, payload);
    return {
      ...newMap,
      [ProxySymbol.onInject]<T>(payload: ProxyPayload<T>) {
        return create(map[ProxySymbol.onInject]?.(payload) ?? map, payload);
      },
      ...overrideMap,
      set(...args) {
        (overrideMap.set ?? newMap.set)(...args);
        return this;
      },
    };
  };

  return <TInput extends Repository<any, any>>(map: TInput) =>
    create(map) as unknown as TOutput;
}
