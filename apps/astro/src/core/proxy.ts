import type { ProxyRequestCache, HandlerFn, RequestFn } from "@nanokit/proxy";

export const Proxy: {
  readonly private: unique symbol;
  readonly cache: unique symbol;
} = {
  private: Symbol("private") as typeof Proxy.private,
  cache: Symbol("cache") as typeof Proxy.cache,
};

type Nested<T> = T | Nested<T>[];

export type InjectableRecord = {
  [key: string]: unknown;
} & {
  [Proxy.private]?: InjectableRecord;
};

export type HandlerRecord = {
  [key: string]: HandlerNode;
} & {
  [Proxy.private]?: HandlerNode | InjectableRecord;
  [Proxy.cache]?: ProxyRequestCache;
};

export type HandlerNode = Nested<HandlerFn> | Nested<HandlerRecord | RequestFn>;

type UnionToIntersection<U> = (U extends any ? (x: U) => void : never) extends (
  x: infer I
) => void
  ? I
  : never;

type Flatten<T> = T extends any[] ? Flatten<T[number]> : T;

type UnionToProxy<T> = UnionToIntersection<T> extends HandlerNode
  ? InferProxy<UnionToIntersection<T>>
  : {};

export type InferProxy<T extends HandlerNode> = RequestFn extends T
  ? {}
  : T extends HandlerFn
  ? T
  : T extends HandlerRecord
  ? {
      -readonly [Key in keyof T as Key extends
        | typeof Proxy.private
        | typeof Proxy.cache
        ? never
        : T[Key] extends []
        ? never
        : Key]: InferProxy<T[Key]>;
    }
  : T extends []
  ? {}
  : T extends [HandlerFn, ...HandlerFn[]][]
  ? T[0] // we assume every handler is equivalent
  : T extends (HandlerRecord | RequestFn)[]
  ? UnionToProxy<Flatten<Exclude<T[number], Function>>> // we assume every function is a RequestFn
  : never;

export type ProxyRecord = { [key: string]: ProxyRecord | HandlerFn };

export type InferHandlers<T extends ProxyRecord> = Nested<{
  [key in keyof T]: T[key] extends ProxyRecord
    ? InferHandlers<T[key]>
    : Nested<T[key]>;
}>;

export type InferPartialHandlers<T extends ProxyRecord> = Nested<{
  [key in keyof T]?: T[key] extends ProxyRecord
    ? InferPartialHandlers<T[key]>
    : Nested<T[key]>;
}>;
