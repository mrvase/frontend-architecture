import type { Inject } from "@nanokit/proxy";
import type { GetVariables } from "./types";

declare const props: unique symbol;

export type Text<T extends Record<string, unknown> = {}> = string &
  ({} extends T
    ? {}
    : {
        [props]: T;
      });

export const text = <const T extends string>(text: T): Text<GetVariables<T>> =>
  text as unknown as Text<GetVariables<T>>;

export const createTexts = <T extends TextRecord>(texts: ToEvaluatables<T>) => {
  return texts as TextsProxy<T>;
};

type ToEvaluatables<T extends TextRecord> = {
  [K in keyof T]: T[K] extends TextRecord ? ToEvaluatables<T[K]> : T[K] | Inject.ProxyRequest<T[K]>;
};

export type TextRecord = {
  [key: string]: TextNode;
};
type TextNode = Text | TextRecord;

type ToArgs<T> = typeof props extends keyof T
  ? {} extends T[typeof props]
    ? [props?: Record<string, never>]
    : [props: T[typeof props]]
  : [];

export type TextsProxyInner<T extends TextRecord> = {
  [K in keyof T]: T[K] extends TextRecord
    ? TextsProxyInner<T[K]>
    : (...args: ToArgs<T[K]>) => string;
};

export type TextsProxy<T extends TextRecord> = {
  t: TextsProxyInner<T>;
};
