import { ProxySymbol } from "@nanokit/proxy";
import { getFirstHandler, type ProxyPayload } from "@nanokit/proxy/internal";
import { ReactiveExtended } from "./signals/signals-extended";
import type { Repository } from "@nanokit/proxy-patterns/repository";
import { defaultPlugin } from "@nanokit/proxy-patterns/plugins/default";

export type MapKey<T extends Map<any, any>> = T extends Map<infer K, any>
  ? K
  : never;

export type MapValue<T extends Map<any, any>> = T extends Map<any, infer V>
  ? V
  : never;

export const signalPlugin =
  () =>
  <T extends Repository<any, any>>(map: T): T => {
    type TKey = string;
    type TValue = unknown;

    const signals = new Map<TKey, ReactiveExtended<TValue | undefined>>();

    const sizeSignal = new ReactiveExtended(() => map.size);

    // initialize signals
    map.forEach((value, key) => {
      signals.set(key, new ReactiveExtended<TValue | undefined>(() => value));
    });

    const create = (map: T, parent?: ReactiveExtended<unknown>): T => {
      return {
        ...defaultPlugin()(map),
        get: (key: TKey) => {
          let signal = signals.get(key);
          if (!signal) {
            // subscribe so that when the signal is set, the parent is updated
            signal = new ReactiveExtended(
              () => undefined as TValue | undefined
            );
            signals.set(key, signal);
          }
          return signal.get(parent);
        },
        set(key: TKey, value: TValue) {
          const signal = signals.get(key);
          if (signal) {
            signal.set(() => value);
          } else {
            signals.set(
              key,
              new ReactiveExtended<TValue | undefined>(() => value)
            );
          }
          map.set(key, value);
          sizeSignal.set(() => map.size);
          return this;
        },
        has(key: TKey) {
          return map.has(key);
        },
        delete: (key: TKey) => {
          const signal = signals.get(key);
          if (signal) {
            signal.set(() => undefined);
          }
          signals.delete(key);
          const result = map.delete(key);
          sizeSignal.set(() => map.size);
          return result;
        },
        clear() {
          signals.forEach((signal) => signal.set(() => undefined));
          signals.clear();
          map.clear();
          sizeSignal.set(() => map.size);
        },
        forEach(
          callbackfn: (value: TValue, key: TKey, map: Map<TKey, TValue>) => void
        ) {
          // subscribe to all

          sizeSignal.get();
          signals.forEach((signal, key) => {
            const value = signal.get();
            if (value !== undefined) {
              callbackfn(value, key, this);
            }
          });
        },
        entries() {
          // subscribe to all

          sizeSignal.get();
          const entries = signals.entries();

          function* transformedEntries() {
            for (const [key, signal] of entries) {
              const value = signal.value;
              if (value !== undefined) {
                yield [key, signal.value] as [TKey, TValue];
              }
            }
            return undefined;
          }

          return transformedEntries();
        },
        keys() {
          sizeSignal.get();
          return map.keys();
        },
        values() {
          // subscribe to all

          sizeSignal.get();
          const values = signals.values();

          function* transformedValues() {
            for (const signal of values) {
              const value = signal.value;
              if (value !== undefined) {
                yield value;
              }
            }
            return undefined;
          }

          return transformedValues();
        },
        get size() {
          sizeSignal.get();
          return map.size;
        },
        [Symbol.iterator]() {
          sizeSignal.get();
          return this.entries();
        },
        [Symbol.toStringTag]: "SignalRepository",
        [ProxySymbol.onInject]<T>(payload: ProxyPayload<T>) {
          const nextMap = map[ProxySymbol.onInject]?.(payload) ?? map;

          if (!payload.context) {
            return create(nextMap, parent);
          }

          const { cache } = getFirstHandler(
            payload.context.request.type,
            payload.context.handlers
          );

          const newParent = cache.getCachedData?.(payload.context.request);

          return create(
            nextMap,
            newParent instanceof ReactiveExtended ? newParent : parent
          );
        },
      } satisfies Repository<any, any> as T;
    };

    return create(map);
  };
