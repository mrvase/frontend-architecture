import { InjectProxyPayload, type ProxyPayload } from "@nanokit/proxy/internal";
import { type Repository } from "../repository";
import { defaultPlugin } from "./default";

export type GcState = {
  name: string;
  time: number;
  timeouts: Map<string, { timeoutId: ReturnType<typeof setTimeout>; startTime: number }>;
};

type GcStateListener = (request: GcState) => void;

const listeners = new Set<GcStateListener>();

const pushGcState = (state: GcState) => {
  listeners.forEach((fn) => fn(state));
};

export const registerGcStateListener = (listener: GcStateListener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const gcPlugin = (options: {
  /**
   * number in milliseconds
   */
  time: number;
  logName?: string;
}) => {
  type TKey = string;
  type TValue = unknown;
  const timeouts = new Map<TKey, { timeoutId: ReturnType<typeof setTimeout>; startTime: number }>();
  const timedOutKeys = new Set<TKey>();

  let gc: ((key: TKey) => void) | null = null;

  const triggerGc = () => {
    if (gc) {
      timedOutKeys.forEach((key) => gc?.(key));
    }
  };

  const cancelTimeout = (key: TKey) => {
    const exists = timeouts.get(key);
    if (exists) {
      clearTimeout(exists.timeoutId);
    }
    timeouts.delete(key);

    if (options.logName) {
      pushGcState({
        name: options.logName,
        time: options.time,
        timeouts: new Map(timeouts),
      });
    }
  };

  const registerActivity = (key: TKey) => {
    cancelTimeout(key);
    timedOutKeys.delete(key);

    const timeoutId = setTimeout(() => {
      timedOutKeys.add(key);
      timeouts.delete(key);
      triggerGc();
    }, options.time);

    timeouts.set(key, {
      timeoutId,
      startTime: Date.now(),
    });

    if (options.logName) {
      pushGcState({
        name: options.logName,
        time: options.time,
        timeouts: new Map(timeouts),
      });
    }
  };

  const create = <T extends Repository<any, any>>(map: T): T => {
    return {
      ...defaultPlugin()(map),
      get: (key: TKey) => {
        registerActivity(key);
        return map.get(key);
      },
      set(key: TKey, value: TValue) {
        registerActivity(key);
        map.set(key, value);
        return this;
      },
      has: (key: TKey) => {
        registerActivity(key);
        return map.has(key);
      },
      delete: (key: TKey) => {
        cancelTimeout(key);
        timedOutKeys.delete(key);
        return map.delete(key);
      },
      clear: () => {
        timeouts.forEach((_, key) => cancelTimeout(key));
        timedOutKeys.clear();
        return map.clear();
      },
      [InjectProxyPayload]<T>(payload: ProxyPayload<T>) {
        return create(map[InjectProxyPayload]?.(payload) ?? map);
      },
    } satisfies Repository<any, any> as T;
  };

  return <T extends Repository<any, any>>(map: T) => {
    gc = (key) => {
      return map.delete(key);
    };
    return create(map);
  };
};
