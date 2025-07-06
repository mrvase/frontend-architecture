import { dispatch } from "@nanokit/proxy";
import {
  type RequestContext,
  trackRequestContext,
  InjectProxyPayload,
  type ProxyPayload,
} from "@nanokit/proxy/internal";
import { EventsSymbol } from "../events";
import { type Repository } from "../repository";
import { defaultPlugin } from "./default";

export const eventPlugin = (options: { eventPrefix?: string | symbol } = {}) => {
  type TKey = string;
  type TValue = unknown;

  const create = <T extends Repository<any, any>>(map: T, context?: RequestContext): T => {
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
      [InjectProxyPayload]<T>(payload: ProxyPayload<T, any>) {
        return create(map[InjectProxyPayload]?.(payload) ?? map, payload.context);
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
