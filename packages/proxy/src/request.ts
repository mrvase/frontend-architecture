/* json types from type-fest */
type JsonObject = { [Key in string]: JsonValue } & {
  [Key in string]?: JsonValue | undefined;
};
type JsonArray = JsonValue[] | readonly JsonValue[];
type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;
/* */

export type RequestArgument = ArrayBuffer | JsonValue | undefined;
export type RequestValue =
  | JsonValue
  | void
  | Promise<JsonValue | void>
  | AsyncIterable<JsonValue | void>;

export type RequestType = "query" | "mutate" | "dispatch";

export declare const RETURN_TYPE: unique symbol;

export type ProxyRequest<T extends RequestValue = RequestValue> = {
  type: string[];
  payload: RequestArgument[];
  [RETURN_TYPE]: T;
  select: <U extends RequestValue>(callback: (value: T) => U) => ProxyRequest<U>;
  transforms?: ((value: RequestValue) => RequestValue)[];
};

export type ProxyEvent<T extends Record<string, unknown>> = {
  type: [T["type"]];
  payload: [Omit<T, "type">];
  [RETURN_TYPE]: void;
};
