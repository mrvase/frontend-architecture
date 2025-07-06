export const createEventBus = <TValue, TOutput = void>() => {
  const handlers = new Set<(error: TValue) => TOutput>();

  const dispatch = (result: TValue) => {
    const results: TOutput[] = [];
    handlers.forEach((handler) => {
      results.push(handler(result));
    });
    return results;
  };

  const registerHandler = (handler: (error: TValue) => TOutput) => {
    handlers.add(handler);
    return () => {
      handlers.delete(handler);
    };
  };

  return {
    dispatch,
    registerHandler,
  };
};

export type EventBus<TValue, TOutput = void> = ReturnType<
  typeof createEventBus<TValue, TOutput>
>;
