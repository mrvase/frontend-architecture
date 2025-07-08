import {
  type FragmentConfig,
  isFragmentConfig,
  type FieldConfig,
  $options,
  type AnyConfig,
  type Shape,
} from "../types";

export type ConfigName = string & { brand: "ConfigName" };

export const baseName = "" as ConfigName;

export const extendName = (name: ConfigName, key: string) => {
  return [name, key].filter(Boolean).join(".") as ConfigName;
};

export const getNameByReverseIndex = (name: ConfigName, index: number) => {
  const keys = name.split(".").slice(0, -1); // removing key from field config
  return keys.slice(0, keys.length - index).join(".") as ConfigName;
};

export type FieldData = {
  name: ConfigName;
  fragments: FragmentConfig<Shape, any>[];
};

export type FieldDataMap = Map<AnyConfig, FieldData>;

export const getFieldData = (config: FragmentConfig<Shape, any>) => {
  const data: FieldDataMap = new Map();

  const recursive = (
    config: FragmentConfig<Shape, any>,
    keyPath = baseName,
    fragments: FragmentConfig<Shape, any>[] = [config]
  ) => {
    const shape = config[$options].shape;

    for (const [key, value] of Object.entries(shape)) {
      const name = extendName(keyPath, key);
      data.set(value, { name, fragments });
      if (isFragmentConfig(value)) {
        recursive(value, name, [value, ...fragments]);
      }
    }
  };

  data.set(config, { name: baseName, fragments: [] });
  recursive(config);

  return data;
};

type FragmentNode = {
  fragment: FragmentConfig<any, any>;
  parent: FragmentNode | null;
  sibling: FragmentNode | FieldNode | null;
  child: FragmentNode | FieldNode | null;
};

type FieldNode = {
  field: FieldConfig<any, any>;
  parent: FragmentNode | null;
  sibling: FragmentNode | FieldNode | null;
};
