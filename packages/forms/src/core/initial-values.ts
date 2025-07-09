import {
  type JsonValue,
  type AnyConfig,
  type FieldConfig,
  isFragmentConfig,
  $options,
} from "../types";

export type InitialValuesMap = Map<FieldConfig, JsonValue>;

export function getInitialValues(
  initialValues: Record<string, JsonValue>,
  config: AnyConfig
) {
  const map = new Map<FieldConfig, JsonValue>();

  const recursive = (
    obj: JsonValue,
    config: AnyConfig,
    keyPath: string[] = []
  ) => {
    if (isFragmentConfig(config)) {
      if (typeof obj !== "object" || obj === null) {
        return;
      }
      for (const [key, value] of Object.entries(obj)) {
        const nextConfig = config[$options].shape[key];
        recursive(value, nextConfig, [...keyPath, key]);
      }
    } else {
      map.set(config, obj);
    }
  };

  recursive(initialValues as JsonValue, config);

  return map;
}

export const mergeMaps = (
  ...[map1, ...maps]: [
    Map<FieldConfig, JsonValue>,
    ...Map<FieldConfig, JsonValue>[]
  ]
) => {
  const next = new Map(map1);
  for (const map of maps) {
    for (const [key, value] of map) {
      next.set(key, value);
    }
  }
  return next;
};
