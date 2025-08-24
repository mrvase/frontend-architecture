import type { ProxyPayload } from "@nanokit/proxy/internal";
import { defaultPlugin } from "./plugins/default";
import type { ProxySymbol } from "@nanokit/proxy";

export interface Repository<K, V> extends Map<K, V> {
  [ProxySymbol.onInject]?(payload: ProxyPayload): this;
}

export type InferRepositoryKey<T> = T extends Repository<infer K, any> ? K : never;
export type InferRepositoryValue<T extends Repository<any, any>> = Exclude<
  ReturnType<T["get"]>,
  undefined
>;

export type WithPlugin<T extends Repository<any, any>> = T & {
  plugin: <TOut extends Repository<any, any>>(arg: (value: T) => TOut) => WithPlugin<TOut>;
  // set(...args: Parameters<T["set"]>): WithPlugin<T>;
  // [InjectProxyPayload]?<U>(payload: ProxyPayload<U>): WithPlugin<T>;
};

const assignPluginFn = <T extends Repository<any, any>>(repository: T): WithPlugin<T> => {
  return {
    ...defaultPlugin()(repository),
    plugin<TOut extends Repository<any, any>>(arg: (value: T) => TOut) {
      const newRepository = arg(repository);
      if ((newRepository as Repository<any, any>) === repository) {
        return this as unknown as WithPlugin<TOut>;
      }
      return assignPluginFn(newRepository);
    },
  };
};

export const createRepository = <T extends Repository<any, any>>(
  ...plugins: ((value: T) => T)[]
): WithPlugin<T> => {
  const map = new Map() as T;
  const repository = plugins.reduceRight((acc, cur) => cur(acc), map);
  return assignPluginFn(repository);
};

type RepositoryPluginFactory<TInputKey, TOutputKey, TInputValue, TOutputValue> = (
  payload?: ProxyPayload
) => RepositoryPlugin<TInputKey, TOutputKey, TInputValue, TOutputValue>;

type RepositoryPlugin<TInputKey, TOutputKey, TInputValue, TOutputValue> = {
  transformInputKey(key: TInputKey): TOutputKey;
  transformOutputKey(key: TOutputKey): TInputKey;
  onGet(
    key: TInputKey,
    value: TOutputValue,
    source: "get" | "forEach" | "values" | "entries"
  ): TOutputValue;
  onSet(key: TInputKey, value: TInputValue): TOutputValue;
  onInitialize(): void;
  onMutate(
    operation:
      | { type: "set"; key: TInputKey }
      | { type: "delete"; key: TInputKey }
      | { type: "clear" }
  ): void;
};
