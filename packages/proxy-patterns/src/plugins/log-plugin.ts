import type { RequestContext, ProxyPayload } from "@nanokit/proxy/internal";
import { type Repository } from "../repository";
import { defaultPlugin } from "./default";
import { ProxySymbol } from "@nanokit/proxy";

export type RepositoryLog =
  | {
      parentRequestId: string | null;
      name: string;
      operation:
        | {
            type: "set";
            key: string;
            map: Map<string, unknown>;
          }
        | {
            type: "delete";
            key: string;
            map: Map<string, unknown>;
          }
        | {
            type: "clear";
            map: Map<string, unknown>;
          };
    }
  | {
      parentRequestId: null;
      name: string;
      operation: {
        type: "initialize";
        map: Map<string, unknown>;
      };
    };
type RequestLogListener = (request: RepositoryLog) => void;

const listeners = new Set<RequestLogListener>();

const pushRepositoryLog = (log: RepositoryLog) => {
  listeners.forEach((fn) => fn(log));
};

export const registerRepositoryLogListener = (listener: RequestLogListener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const logPlugin = (options: { prefix: string }) => {
  type TKey = string;
  type TValue = unknown;

  const create = <T extends Repository<any, any>>(
    map: T,
    context?: RequestContext
  ): T => {
    return {
      ...defaultPlugin()(map),
      set(key: TKey, value: TValue) {
        map.set(key, value);
        if (context) {
          pushRepositoryLog({
            name: options.prefix,
            parentRequestId: context?.requestId ?? null,
            operation: {
              type: "set",
              key,
              map: new Map(map),
            },
          });
        }
        return this;
      },
      delete: (key: TKey) => {
        const result = map.delete(key);
        pushRepositoryLog({
          name: options.prefix,
          parentRequestId: context?.requestId ?? null,
          operation: {
            type: "delete",
            key,
            map: new Map(map),
          },
        });
        return result;
      },
      clear: () => {
        map.clear();
        if (context) {
          pushRepositoryLog({
            name: options.prefix,
            parentRequestId: context.requestId,
            operation: {
              type: "clear",
              map: new Map(map),
            },
          });
        }
      },
      [ProxySymbol.onInject]<T>(payload: ProxyPayload<T>) {
        return create(
          map[ProxySymbol.onInject]?.(payload) ?? map,
          payload.context
        );
      },
    } satisfies Repository<any, any> as T;
  };

  return <T extends Repository<any, any>>(map: T) => {
    pushRepositoryLog({
      name: options.prefix,
      parentRequestId: null,
      operation: {
        type: "initialize",
        map: new Map(map),
      },
    });
    return create(map);
  };
};
