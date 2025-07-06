import { InjectProxyPayload, type ProxyPayload } from "@nanokit/proxy/internal";
import type { Repository } from "../repository";

export const persistPlugin = <TValue = unknown>(options: {
  name: string;
  storage?: () => Storage;
  partialize?: (value: TValue) => TValue;
}) => {
  type TKey = string;
  let initialized = false;

  const create = <T extends Repository<any, any>>(map: T): T => {
    const getMap = () => {
      if (!initialized) {
        let mapString: string | null = null;
        if (typeof window !== "undefined" && options.storage) {
          mapString = options.storage().getItem(options.name);
        }

        const entries: [TKey, TValue][] = mapString ? JSON.parse(mapString) : [];

        entries.forEach(([key, value]) => {
          map.set(key, value);
        });
        initialized = true;
      }

      return map;
    };

    const setMap = <T>(fn: (map: Map<TKey, TValue>) => T): T => {
      const map = getMap();
      const result = fn(map);
      if (typeof window !== "undefined" && options.storage) {
        const string = JSON.stringify(
          [...map].map(([key, value]) => [
            key,
            options.partialize ? options.partialize(value) : value,
          ])
        );
        options.storage().setItem(options.name, string);
      }
      return result;
    };

    return {
      get: (key: TKey) => getMap().get(key),
      has: (key: TKey) => getMap().has(key),
      set(key: TKey, value: TValue) {
        setMap((map) => {
          map.set(key, value);
        });
        return this;
      },
      delete: (key: TKey) => setMap((map) => map.delete(key)),
      clear: () => setMap((map) => map.clear()),
      keys: () => getMap().keys(),
      values: () => getMap().values(),
      entries: () => getMap().entries(),
      forEach: (callbackfn: (value: TValue, key: TKey, map: Map<TKey, TValue>) => void) =>
        getMap().forEach(callbackfn),
      get size() {
        return getMap().size;
      },
      [Symbol.iterator]() {
        return getMap()[Symbol.iterator]();
      },
      get [Symbol.toStringTag]() {
        return getMap()[Symbol.toStringTag];
      },
      [InjectProxyPayload]<T>(payload: ProxyPayload<T, any>) {
        return create(map[InjectProxyPayload]?.(payload) ?? map);
      },
    } satisfies Repository<any, any> as T;
  };

  return <T extends Repository<any, any>>(map: T) => create(map);
};
