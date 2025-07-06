import {
  FieldConfig,
  Shape,
  FragmentConfig,
  JsonValue,
  $brand,
  CoerceOutput,
  FormTypes,
  InferTypeFromShape,
  $options,
  Prettify,
  FieldType,
} from "./types";

type Fragment<
  TShape extends Shape,
  TResult extends JsonValue = InferTypeFromShape<TShape>
> = TShape &
  FragmentConfig<TShape, TResult> & {
    coerce: <TNewResult extends JsonValue>(
      value: (
        value: Prettify<InferTypeFromShape<TShape>>
      ) => CoerceOutput<TNewResult>
    ) => Fragment<TShape, TNewResult>;
  };

const createFragment = <
  TShape extends Shape,
  TResult extends JsonValue = InferTypeFromShape<TShape>
>(
  shape: TShape,
  coerceFn?: (
    value: Prettify<InferTypeFromShape<TShape>>
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
  TResult extends JsonValue = FormTypes[TType]
> = FieldConfig<TType, TResult> & {
  coerce: <TNewResult extends JsonValue>(
    value: (value: FormTypes[TType]) => CoerceOutput<TNewResult>
  ) => Field<TType, TNewResult>;
};

const createField = <
  TType extends FieldType,
  TResult extends JsonValue = FormTypes[TType]
>(
  type: TType,
  coerceFn?: (value: FormTypes[TType]) => CoerceOutput<TResult>
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
