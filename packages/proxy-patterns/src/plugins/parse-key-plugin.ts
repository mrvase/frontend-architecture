import type { ProxyPayload } from "@nanokit/proxy/internal";
import type { Repository } from "../repository";
import { defaultPlugin } from "./default";
import { ProxySymbol } from "@nanokit/proxy";

type InferRepositoryValue<T extends Repository<any, any>> = ReturnType<
  T["values"]
> extends Iterator<infer V>
  ? V
  : never;

export type ParsedKeyRepository<
  TKey,
  TValue,
  T extends Repository<any, any>
> = Pick<T, typeof Symbol.toStringTag | "clear" | "size" | "values"> & {
  get(key: TKey): ReturnType<T["get"]>;
  has(key: TKey): boolean;
  set(
    key: TKey,
    value: Parameters<T["set"]>[1]
  ): ParsedKeyRepository<TKey, TValue, T>;
  delete(key: TKey): boolean;
  forEach(
    callbackfn: (
      value: TValue,
      key: TKey,
      map: ParsedKeyRepository<TKey, TValue, T>
    ) => void,
    thisArg?: any
  ): void;
  keys(): MapIterator<TKey>;
  entries(): MapIterator<[TKey, TValue]>;
  [Symbol.iterator](): MapIterator<[TKey, TValue]>;
};

export const parseKeyPlugin = <TKey, TKeySerialized extends string>(options: {
  serialize: (key: TKey) => TKeySerialized;
  parse: (key: TKeySerialized) => TKey;
}) => {
  const create = <T extends Repository<TKeySerialized, any>>(
    map: T
  ): ParsedKeyRepository<TKey, InferRepositoryValue<T>, T> => {
    return {
      ...defaultPlugin()(map),
      get(key) {
        return map.get(options.serialize(key));
      },
      has(key) {
        return map.has(options.serialize(key));
      },
      set(key, value) {
        map.set(options.serialize(key), value);
        return this;
      },
      delete(key) {
        return map.delete(options.serialize(key));
      },
      forEach(callbackfn) {
        map.forEach((value, key) => {
          callbackfn(value, options.parse(key), this);
        });
      },
      keys() {
        const iterator = map.keys();

        return (function* () {
          for (const key of iterator) {
            yield options.parse(key) as TKey;
          }
          return undefined;
        })();
      },
      entries() {
        const iterator = map.entries();

        return (function* () {
          for (const [key, value] of iterator) {
            yield [options.parse(key), value] as [TKey, any];
          }
          return undefined;
        })();
      },
      [Symbol.iterator]() {
        return this.entries();
      },
      [ProxySymbol.onInject]<T>(payload: ProxyPayload<T>) {
        return create(map[ProxySymbol.onInject]?.(payload) ?? map);
      },
    } satisfies ParsedKeyRepository<TKey, InferRepositoryValue<T>, T>;
  };

  return <T extends Repository<TKeySerialized, any>>(map: T) => create(map);
};
