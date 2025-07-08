/* json types from type-fest */
type JsonObject = { [Key in string]: JsonValue } & {
  [Key in string]?: JsonValue | undefined;
};
type JsonArray = JsonValue[] | readonly JsonValue[];
type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;
/* */

export type MaybePromise<T> = T | Promise<T>;

export type RequestValue = MaybePromise<JsonValue | void>;

export type RequestType = "query" | "mutate" | "dispatch";

export declare const RETURN_TYPE: unique symbol;

export type ProxyRequest<T = unknown> = {
  type: string[];
  payload: unknown[];
  [RETURN_TYPE]: T;
  select: <U>(callback: (value: T) => U) => ProxyRequest<U>;
  transforms?: ((value: unknown) => unknown)[];
};

export type ProxyEvent<T extends Record<string, unknown>> = {
  type: [T["type"]];
  payload: [Omit<T, "type">];
  [RETURN_TYPE]: void;
};
