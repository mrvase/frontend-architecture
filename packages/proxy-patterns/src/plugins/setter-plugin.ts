import { InjectProxyPayload, type ProxyPayload } from "@nanokit/proxy/internal";
import { type Repository, type InferRepositoryKey, type InferRepositoryValue } from "../repository";
import { defaultPlugin } from "./default";

export const SkipToken = Symbol("SkipToken");

export type ExtendedRepository<T extends Repository<unknown, unknown>> = T & {
  set: (
    key: InferRepositoryKey<T>,
    value:
      | InferRepositoryValue<T>
      | ((value?: InferRepositoryValue<T>) => InferRepositoryValue<T> | typeof SkipToken)
  ) => ExtendedRepository<T>;
};

export const setterPlugin = () => {
  const create = <T extends Repository<any, any>>(map: T): ExtendedRepository<T> => {
    return {
      ...defaultPlugin()(map),
      set(key, value) {
        const normalizedValue = typeof value === "function" ? value(map.get(key)) : value;
        if (normalizedValue === SkipToken) {
          return this;
        }
        map.set(key, normalizedValue);
        return this;
      },
      [InjectProxyPayload]<T>(payload: ProxyPayload<T>) {
        return create(map[InjectProxyPayload]?.(payload) ?? map);
      },
    };
  };

  return <T extends Repository<any, any>>(map: T) => create(map);
};
