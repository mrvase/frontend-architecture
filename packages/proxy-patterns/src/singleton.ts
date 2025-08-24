import type { ProxyPayload } from "@nanokit/proxy/internal";
import {
  createRepository,
  type Repository,
  type WithPlugin as WithRepositoryPlugin,
} from "./repository";
import { defaultPlugin } from "./plugins/default";
import { ProxySymbol, type RequestValue } from "@nanokit/proxy";

export interface Singleton<V> {
  get(): V | undefined;
  set(value: V): void;
  [ProxySymbol.onInject]?<T extends RequestValue>(payload: ProxyPayload<T>): this;
}

export type InferSingletonValue<T extends Singleton<any>> = Exclude<
  ReturnType<T["get"]>,
  undefined
>;

export type ConvertToRepository<T extends Singleton<any>> = Repository<
  null,
  InferSingletonValue<T>
>;

export interface ConvertToSingleton<T extends Repository<null, any>> {
  get(): ReturnType<T["get"]>;
  set(value: Parameters<T["set"]>[1]): void;
  [ProxySymbol.onInject]?(payload: ProxyPayload): this;
}

export type WithPlugin<T extends Singleton<any>> = T & {
  plugin: <TOut extends Repository<null, any>>(
    arg: (value: ConvertToRepository<T>) => TOut
  ) => WithPlugin<ConvertToSingleton<TOut>>;
};

function createSingletonFacade<T extends Singleton<any>>(
  map: WithRepositoryPlugin<Repository<null, InferSingletonValue<T>>>
): WithPlugin<T> {
  const result: WithPlugin<Singleton<any>> = {
    get: () => map.get(null),
    set: (value) => {
      map.set(null, value);
    },
    plugin<TOut extends Repository<null, any>>(
      arg: (value: ConvertToRepository<T>) => TOut
    ): WithPlugin<ConvertToSingleton<TOut>> {
      const next = map.plugin<TOut>(arg) as unknown as WithRepositoryPlugin<Repository<null, any>>;
      if (next === map) {
        return this;
      }
      return createSingletonFacade(next);
    },
    [ProxySymbol.onInject]<U extends RequestValue>(payload: ProxyPayload<U>) {
      return createSingletonFacade<Singleton<any>>(map[ProxySymbol.onInject]?.(payload) ?? map);
    },
  } satisfies WithPlugin<Singleton<any>>;

  return result as WithPlugin<T>;
}

export const createSingleton = <T extends Singleton<any>>(
  ...plugins: ((value: ConvertToRepository<T>) => ConvertToRepository<T>)[]
): WithPlugin<T> => {
  const map = createRepository(...plugins);
  return createSingletonFacade(map);
};

export interface DefaultedSingleton<V> extends Repository<null, V> {
  get(key: null): V;
}

export const defaultValuePlugin =
  <TValue>(defaultValue: TValue) =>
  <T extends Repository<null, TValue>>(map: T): DefaultedSingleton<TValue> => {
    const create = <T extends Repository<null, TValue>>(map: T): DefaultedSingleton<TValue> =>
      ({
        ...defaultPlugin()(map),
        get() {
          const value = map.get(null);
          if (typeof value === "undefined") {
            return defaultValue;
          }
          return value;
        },
        [ProxySymbol.onInject](payload: ProxyPayload) {
          return create(map[ProxySymbol.onInject]?.(payload) ?? map);
        },
      } as DefaultedSingleton<TValue>);

    return create(map);
  };

/*
export const defaultValuePlugin =
  <TValue>(defaultValue: TValue) =>
  <T extends Repository<null, TValue>>(map: T): DefaultedSingleton<TValue> => {
    map.set(null, defaultValue);
    return map;
  };
*/
