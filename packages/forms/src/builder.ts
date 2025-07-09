import {
  type FieldConfig,
  type Shape,
  type FragmentConfig,
  type JsonValue,
  $brand,
  type CoerceOutput,
  type FieldTypes,
  type InferFormDataFromShape,
  $options,
  type Prettify,
  type FieldType,
} from "./types";

type Fragment<
  TShape extends Shape,
  TResult extends JsonValue = InferFormDataFromShape<TShape>
> = TShape &
  FragmentConfig<TShape, TResult> & {
    coerce: <TNewResult extends JsonValue>(
      value: (
        value: Prettify<InferFormDataFromShape<TShape>>
      ) => CoerceOutput<TNewResult>
    ) => Fragment<TShape, TNewResult>;
  };

const createFragment = <
  TShape extends Shape,
  TResult extends JsonValue = InferFormDataFromShape<TShape>
>(
  shape: TShape,
  coerceFn?: (
    value: Prettify<InferFormDataFromShape<TShape>>
  ) => CoerceOutput<TResult>
): Fragment<TShape, TResult> => {
  return {
    ...shape,
    coerce: (value) => createFragment(shape, value),
    [$brand]: "Fragment",
    [$options]: {
      shape,
      coerceFn,
    },
  };
};

type Field<
  TType extends FieldType,
  TResult extends JsonValue = FieldTypes[TType]
> = FieldConfig<TType, TResult> & {
  coerce: <TNewResult extends JsonValue>(
    value: (value: TResult) => CoerceOutput<TNewResult>
  ) => Field<TType, TNewResult>;
};

const createField = <
  TType extends FieldType,
  TResult extends JsonValue = FieldTypes[TType]
>(
  type: TType,
  coerceFn?: (value: never) => CoerceOutput<TResult>
): Field<TType, TResult> => {
  return {
    coerce: (value) => createField(type, value),
    type,
    [$brand]: "Field",
    [$options]: {
      coerceFn,
    },
  };
};

export const f = new Proxy(
  {} as Prettify<
    {
      fragment: <TShape extends Shape>(shape: TShape) => Fragment<TShape>;
    } & {
      [Key in FieldType]: () => ReturnType<typeof createField<Key>>;
    }
  >,
  {
    get(_, prop) {
      if (prop === "fragment") {
        return createFragment;
      }
      return () => createField(prop as FieldType);
    },
  }
);
