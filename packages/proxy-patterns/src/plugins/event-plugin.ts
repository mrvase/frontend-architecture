import { dispatch, ProxySymbol } from "@nanokit/proxy";
import {
  type RequestContext,
  trackRequestContext,
  type ProxyPayload,
} from "@nanokit/proxy/internal";
import { EventsSymbol } from "../events";
import { type Repository } from "../repository";
import { defaultPlugin } from "./default";

export const eventPlugin = (
  options: { eventPrefix?: string | symbol } = {}
) => {
  type TKey = string;
  type TValue = unknown;

  const create = <T extends Repository<any, any>>(
    map: T,
    context?: RequestContext
  ): T => {
    return {
      ...defaultPlugin()(map),
      get: (key: TKey) => map.get(key),
      set(key: TKey, value: TValue) {
        map.set(key, value);
        const events = (value as any)[EventsSymbol];
        if (Array.isArray(events)) {
          if (options.eventPrefix) {
            trackRequestContext(context, () => {
              events.forEach((event: any) => {
                const prefixedEvent = {
                  ...event,
                  type: [options.eventPrefix, ...event.type],
                };
                return dispatch(prefixedEvent);
              });
            });
          }
          events.length = 0;
        }
        return this;
      },
      [ProxySymbol.onInject]<T>(payload: ProxyPayload<T>) {
        return create(
          map[ProxySymbol.onInject]?.(payload) ?? map,
          payload.context
        );
      },
    };
  };

  return <T extends Repository<any, any>>(map: T) => create(map);
};

/*
export const eventPlugin = (options: { eventPrefix?: string | symbol } = {}) => {
  return createPlugin((map, payload) => ({
    get: (key) => map.get(key),
    set: (key, value) => {
      map.set(key, value);
      const events = (value as any)[EventsSymbol];
      if (Array.isArray(events)) {
        if (options.eventPrefix) {
          trackRequestContext(payload?.context, () => {
            events.forEach((event: any) => {
              const prefixedEvent = {
                ...event,
                type: [options.eventPrefix, ...event.type],
              };
              return dispatch(prefixedEvent);
            });
          });
        }
        events.length = 0;
      }
    },
  }));
};
*/
