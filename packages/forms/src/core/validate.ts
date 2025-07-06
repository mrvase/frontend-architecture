import {
  JsonValue,
  FormError,
  FormInterrupt,
  AnyConfig,
  CoerceOutput,
  interrupt,
  isFragmentConfig,
  FieldConfig,
  FragmentConfig,
  Shape,
  isError,
  isInterrupt,
  $options,
  FieldType,
} from "../types";
import { orderedJsonStringify } from "../utils/json-stringify";
import { NestedMap } from "../utils/nested-map";
import {
  createResolvablePromise,
  ResolvablePromise,
} from "../utils/resolvable-promise";
import {
  ConfigName,
  extendName,
  FieldData,
  getNameByReverseIndex,
} from "./field-data";

type ValueKey = string;

type ConfigCache = {
  current: ValueKey;
  cache: Map<
    ValueKey,
    {
      value:
        | JsonValue
        | FormError
        | ResolvablePromise<JsonValue | FormError | FormInterrupt>;
    }
  >;
};

type CoerceFn = (...args: any[]) => any;

type CacheMap = NestedMap<[ConfigName, CoerceFn | null], ConfigCache>;

export function getCacheKey(obj: JsonValue): ValueKey {
  return orderedJsonStringify(obj);
}

const UNWRAP = Symbol("UNWRAP");

export const createProxy = () => {
  const subscriptions: FieldConfig<FieldType, any>[] = [];

  const create = (value: JsonValue, config: FragmentConfig) => {
    return new Proxy(value as object, {
      get(target, prop) {
        if (prop === UNWRAP) {
          return value;
        }
        if (prop in target) {
          const value = target[prop as keyof typeof target];
          const next = config[$options].shape[prop as string] as AnyConfig;
          if (isFragmentConfig(next)) {
            return create(value, next);
          }
          subscriptions.push(next);
          return value;
        }
        return undefined;
      },
      has(target, prop) {
        if (prop === UNWRAP) {
          return true;
        }
        return prop in target;
      },
    }) as JsonValue;
  };

  const unwrap = (value: JsonValue) => {
    if (typeof value === "object" && value !== null && UNWRAP in value) {
      return value[UNWRAP] as JsonValue;
    }
    return value;
  };

  return {
    create,
    unwrap,
    subscriptions,
  };
};

export const createValidationCache = () => {
  const cacheMap: CacheMap = new Map();

  const getConfigCache = (
    config: AnyConfig,
    name: ConfigName
  ): ConfigCache | undefined => {
    return cacheMap.get(name)?.get(config[$options].coerceFn ?? null);
    // return cacheMap.get(name)?.get(config[$options].coerceFn ?? null);
  };

  const setConfigCache = (
    config: AnyConfig,
    name: ConfigName,
    value: ConfigCache
  ) => {
    let coerceMap = cacheMap.get(name);
    if (!coerceMap) {
      coerceMap = new Map();
      cacheMap.set(name, coerceMap);
    }
    coerceMap.set(config[$options].coerceFn ?? null, value);
  };

  const getCurrentValue = (config: AnyConfig, name: ConfigName) => {
    const configCache = getConfigCache(config, name);
    return configCache?.cache.get(configCache?.current)?.value;
  };

  const buildFragmentValue = (
    fragmentConfig: FragmentConfig<Shape, any>,
    name: ConfigName
  ) => {
    // fragments always use cache
    // if a child does not have a cache value, the fragment is not ready to be validated

    const values: Record<string, JsonValue> = {};

    const children = Object.entries(fragmentConfig[$options].shape as Shape);
    for (const [key, config] of children) {
      // we do not need to await a promise
      // if a a child field is validating, it will trigger the fragment validation itself
      const current = getCurrentValue(config, extendName(name, key));
      if (
        (isFragmentConfig(config) && current === undefined) ||
        (config[$options].coerceFn && current === undefined) ||
        isError(current) ||
        current instanceof Promise
      ) {
        return undefined;
      }
      values[key] = current ?? null;
    }

    return values;
  };

  const buildFragmentData = (
    fragmentConfig: FragmentConfig<Shape, any>,
    name: ConfigName
  ) => {
    const data: Record<string, JsonValue> = {};

    const children = Object.entries(fragmentConfig[$options].shape as Shape);
    for (const [key, config] of children) {
      if (isFragmentConfig(config)) {
        data[key] = buildFragmentData(config, extendName(name, key));
      } else {
        // get uncoerced data from key
        const current = getConfigCache(config, extendName(name, key))?.current;
        data[key] = current ? (JSON.parse(current) as JsonValue) : null;
      }
    }

    return data;
  };

  const validate = (
    value: JsonValue,
    config: AnyConfig,
    promiseOptions: {
      /**
       * when the original promise resolves (not the interruptible promise)
       * */
      onPromiseSuccess?: (value: JsonValue) => void;
      /**
       * when the original promise rejects (not the interruptible promise)
       * */
      onPromiseError?: (error: FormError) => void;
    } = {}
  ) => {
    const coerce = config[$options].coerceFn as
      | ((value: JsonValue) => CoerceOutput<JsonValue>)
      | undefined;

    if (!coerce) {
      return value;
    }

    const isFragment = isFragmentConfig(config);

    const proxy = createProxy();
    const proxyValue = isFragment ? proxy.create(value, config) : value;
    const subscriptions = isFragment ? proxy.subscriptions : [config];

    const coercedValue = coerce(proxyValue);

    const handleResult = (res: JsonValue | FormError | FormInterrupt) => {
      return isError(res) ? { ...res, subscriptions } : proxy.unwrap(res);
    };

    if (coercedValue instanceof Promise) {
      const promise = createResolvablePromise<
        JsonValue | FormError | FormInterrupt
      >();

      // We use the original promise to set resulting value.
      // This ensures that a field which shows an error message
      // is a non-promise in cache
      coercedValue
        .then((res) => {
          const value = handleResult(res);
          promiseOptions.onPromiseSuccess?.(value);
          promise.resolve(value);
        })
        .catch((err) => {
          promiseOptions.onPromiseError?.(err);
          promise.reject(err);
        });

      return Object.assign(promise, { original: coercedValue });
    }

    return handleResult(coercedValue);
  };

  const cachedValidate = async (
    value: JsonValue,
    config: AnyConfig,
    name: ConfigName
  ): Promise<FormError | FormInterrupt | undefined> => {
    const cacheKey = getCacheKey(value);

    let configCache = getConfigCache(config, name);

    const previousCacheKey = configCache?.current;

    if (!configCache) {
      configCache = { cache: new Map(), current: cacheKey };
      setConfigCache(config, name, configCache);
    }

    // interrupt output from ongoing validation of stale input
    if (previousCacheKey && previousCacheKey !== cacheKey) {
      const previousValue = configCache.cache.get(previousCacheKey)?.value;

      if (previousValue instanceof Promise) {
        previousValue.resolve(interrupt);
      }
    }

    configCache.current = cacheKey;

    let cachedValue = configCache.cache.get(cacheKey)?.value;

    if (cachedValue === undefined) {
      cachedValue = validate(value, config, {
        onPromiseSuccess: (value) => {
          configCache.cache.set(cacheKey, { value });
        },
        onPromiseError: () => {
          configCache.cache.delete(cacheKey);
        },
      });

      configCache.cache.set(cacheKey, { value: cachedValue });
    }

    const result = await cachedValue;

    if (isError(result) || isInterrupt(result)) {
      return result;
    }
  };

  const validateFragment = async (
    config: FragmentConfig<Shape, any>,
    name: ConfigName
  ): Promise<FormError | FormInterrupt | undefined> => {
    const value = buildFragmentValue(config, name);

    if (!value) {
      return undefined;
    }

    return await cachedValidate(value, config, name);
  };

  const validateField = async (
    value: JsonValue,
    config: FieldConfig<FieldType, any>,
    data: FieldData
  ): Promise<FormError | FormInterrupt | undefined> => {
    const result = await cachedValidate(value, config, data.name);

    if (isError(result) || isInterrupt(result)) {
      return result;
    }

    let i = 0;
    for (const child of data.fragments) {
      const name = getNameByReverseIndex(data.name, i);
      const result = await validateFragment(child, name);
      if (result) {
        return result;
      }
      i++;
    }
  };

  return {
    getCurrentValue,
    buildFragmentData,
    buildFragmentValue,
    validate: validateField,
  };
};

export type ValidationCache = ReturnType<typeof createValidationCache>;
