import { createProxyObject, type RETURN_TYPE } from "@nanokit/proxy/internal";

export type Resolvers<State extends object = any> = {
  [Key: string]: (payload: any) => State | ((state: State) => State);
};

type DefaultedPayload<TPayload, TDefaultPayload extends object> = {
  [Key in keyof TPayload as Key extends keyof TDefaultPayload
    ? TPayload[Key] extends TDefaultPayload[Key]
      ? never
      : Key
    : Key]: TPayload[Key];
} & {};

type OptionalParameter<T extends object> = {} extends T
  ? []
  : undefined extends T
    ? []
    : [payload: T];

export type DefaultedResolvers<
  TResolvers extends Resolvers,
  TDefaultPayload extends object = {},
> = {
  [Key in keyof TResolvers]: (
    ...args: OptionalParameter<
      DefaultedPayload<Parameters<TResolvers[Key]>[0], TDefaultPayload>
    >
  ) => ReturnType<TResolvers[Key]>;
} & {};

type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

export type ProxyEvent<T extends Record<string, unknown>> = {
  type: [T["type"]];
  payload: [Omit<T, "type">];
  [RETURN_TYPE]: void;
};

export type InferEvent<T extends Resolvers<any>> = {
  [Key in keyof T]: Key extends string
    ? ProxyEvent<
        Prettify<
          {
            type: Key;
          } & Parameters<T[Key]>[0]
        >
      >
    : never;
}[keyof T];

export type Decider<TPayload = any> = (arg: TPayload) => Decision;

export type Decision<
  TState extends object = any,
  T extends ProxyEvent<any> = ProxyEvent<any>,
> = ((state: TState) => T) | T | undefined;

export type InferDecision<TRecord extends Resolvers> = Decision<
  TRecord extends Resolvers<infer S> ? S : object,
  InferEvent<TRecord>
> & {};

export const EventsSymbol = Symbol("events");

type InferState<T> = T extends Resolvers<infer S> ? S : never;

export function applyEvent<TResolvers extends Resolvers>(handlers: TResolvers) {
  type TState = InferState<TResolvers>;

  return (decision: InferDecision<TResolvers> & {}) => {
    return (state: TState | undefined = undefined): TState => {
      if (!decision) {
        return state as any;
      }

      let event: ProxyEvent<any> | undefined;

      if (typeof decision !== "function") {
        event = decision;
      } else if (state) {
        event = decision(state);
      }

      if (!event) {
        throw new Error("Decision expected a state object to be available");
      }

      const { type, payload } = event;
      const outcome = handlers[type[0]](payload[0] as any);

      let newState: TState | undefined;

      if (typeof outcome !== "function") {
        newState = outcome;
      } else if (state) {
        newState = outcome(state);
      }

      if (!newState) {
        throw new Error(
          "Event handler expected a state object to be available"
        );
      }

      const prevEvents = (state as any)?.[EventsSymbol] ?? [];

      return { ...newState, [EventsSymbol]: [...prevEvents, event] };
    };
  };
}

export const proxyEvents = <
  T extends Resolvers,
  U extends Record<string, unknown> = never,
>(
  handlers: T,
  resolve?: (arg: InferState<T>) => U
) => {
  return createProxyObject((request) => {
    return (state: InferState<T>) => {
      const extra = resolve?.(state);
      if (extra) {
        const payload = [{ ...(request.payload[0] as object), ...extra }];
        return applyEvent(handlers)({ ...request, payload } as any)(state);
      }
      return applyEvent(handlers)(request as any)(state);
    };
  }) as DefaultedResolvers<T, U>;
};

/*
export type EventsProxy<T extends Resolvers> = {
  [K in keyof T]: T[K] extends (arg: infer A) => any
    ? (arg: A) => ProxyEvent<
        Prettify<
          {
            type: K;
          } & A
        >
      >
    : never;
} & {};

export const proxyEvents = <T extends Resolvers>() => {
  return createProxyObject((request) => request) as any as EventsProxy<T>;
};
*/
