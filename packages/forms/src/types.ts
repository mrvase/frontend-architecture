export const $brand = Symbol("BAND");
export const $options = Symbol("OPTIONS");

/* Json types are from type-fest */
type JsonObject = { [Key in string]: JsonValue } & {
  [Key in string]?: JsonValue | undefined;
};
type JsonArray = JsonValue[] | readonly JsonValue[];
type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;

export type FormError<T extends string | null = string> = {
  [$brand]: "Error";
  message: T | null;
  subscriptions: FieldConfig<any, any>[];
  silent?: boolean;
};

export type FormInterrupt = {
  [$brand]: "Interrupt";
};

export const interrupt: FormInterrupt = {
  [$brand]: "Interrupt",
};

const isObject = (value: unknown): value is Record<string, unknown> => {
  return value !== null && typeof value === "object";
};

const isBrand = <T extends string>(
  value: unknown,
  brand: T
): value is { [$brand]: T } => {
  return isObject(value) && $brand in value && value[$brand] === brand;
};

export type CoerceOutput<T extends JsonValue> =
  | T
  | FormError
  | Promise<T | FormError>;

export const error = <T extends string>(message: T): FormError<T> => {
  return {
    [$brand]: "Error",
    message,
    subscriptions: [],
  };
};

export const resetError = (error: FormError): FormError<null> => {
  return {
    [$brand]: "Error",
    message: null,
    subscriptions: error.subscriptions,
  };
};

export const silenceError = (error: FormError): FormError => {
  return {
    ...error,
    silent: true,
  };
};

export const isError = (value: unknown): value is FormError => {
  return isBrand(value, "Error");
};

export const isInterrupt = (value: unknown): value is FormInterrupt => {
  return isBrand(value, "Interrupt");
};

export interface FieldTypes {
  string: string | null;
  number: string | null;
}
export type FieldType = keyof FieldTypes;

export type FieldConfig<
  TType extends FieldType = FieldType,
  TResult extends JsonValue = FieldTypes[TType]
> = {
  type: TType;
  [$brand]: "Field";
  [$options]: {
    coerceFn?: (value: never) => CoerceOutput<TResult>;
  };
};

export type Shape = Record<
  string,
  FieldConfig<any, any> | FragmentConfig<any, any>
>;

export type FragmentConfig<
  TShape extends Shape = Shape,
  TResult extends JsonValue = InferFormDataFromShape<TShape>
> = {
  [$brand]: "Fragment";
  [$options]: {
    shape: TShape;
    coerceFn?: (value: InferFormDataFromShape<TShape>) => CoerceOutput<TResult>;
  };
};

export type AnyConfig =
  | FieldConfig<FieldType, any>
  | FragmentConfig<Shape, any>;

export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

export type InferFormStateFromShape<T extends Shape> = {
  [K in keyof T]: T[K] extends FieldConfig<infer TType, any>
    ? TType extends FieldType
      ? FieldTypes[TType]
      : never
    : T[K] extends FragmentConfig<infer TShape, any>
    ? Prettify<Partial<InferFormStateFromShape<TShape>>>
    : never;
};
export type InferFormState<T extends FragmentConfig<any, any>> =
  T extends FragmentConfig<infer Shape, any>
    ? Prettify<Partial<InferFormStateFromShape<Shape>>>
    : never;

export type InferFormDataFromShape<T extends Shape> = {
  [K in keyof T]: T[K] extends FieldConfig<any, infer TResult>
    ? TResult
    : T[K] extends FragmentConfig<any, infer TResult>
    ? TResult
    : never;
};
export type InferFormData<T extends FragmentConfig<any, any>> =
  T extends FragmentConfig<any, infer TResult> ? Prettify<TResult> : never;

export const isFragmentConfig = (
  value: unknown
): value is FragmentConfig<Shape, any> => {
  return isBrand(value, "Fragment");
};

export const isFieldConfig = (
  value: unknown
): value is FieldConfig<FieldType, any> => {
  return isBrand(value, "Field");
};
