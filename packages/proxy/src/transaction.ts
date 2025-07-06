import {
  getRequestContext,
  type RequestContext,
  type RequestTransaction,
} from "./context";
import type { ProxyRequest } from "./request";

let TransactionContext: RequestTransaction | undefined = undefined;

export const getSyncTransactionContext = <
  TAttributes extends Record<string, unknown>
>() => TransactionContext as RequestTransaction<TAttributes> | undefined;

export const getTransactionContext = <
  TAttributes extends Record<string, unknown>
>(
  context?: RequestContext
) =>
  (TransactionContext ??
    context?.transaction ??
    getRequestContext()?.transaction) as
    | RequestTransaction<TAttributes>
    | undefined;

const awaitTransaction = async (context: Promise<unknown>[]) => {
  while (context.length) {
    const current = [...context];
    context.length = 0;
    await Promise.all(current);
  }
};

const wrapTransaction = <T>(
  fn: (context: RequestTransaction) => T,
  attributes?: Record<string, unknown>
): T => {
  const prevTransactionContext = TransactionContext;
  const context: RequestTransaction = {
    promises: [],
    onSuccess: [],
    onError: [],
    attributes: attributes ?? {},
  };

  try {
    TransactionContext = context;

    const response = fn(context);

    return response;
  } catch (err) {
    context.onError.forEach((fn) => fn());
    throw err;
  } finally {
    TransactionContext = prevTransactionContext;
  }
};

const syncTransaction = <T>(fn: () => T): T => {
  // this allows the response to be sync.
  // in particular, an error is not thrown from context promises
  // since these would be uncatchable when the promise is not returned.

  return wrapTransaction((context) => {
    const response = fn();

    if (response instanceof Promise) {
      return Promise.all([response, awaitTransaction(context.promises)])
        .catch((err) => {
          context.onError.forEach((fn) => fn());
          throw err;
        })
        .then(([res]) => {
          context.onSuccess.forEach((fn) => fn());
          return res;
        }) as T;
    } else if (context.promises.length) {
      void awaitTransaction(context.promises)
        .catch(() => {
          context.onError.forEach((fn) => fn());
        })
        .then(() => {
          context.onSuccess.forEach((fn) => fn());
        });
    } else {
      context.onSuccess.forEach((fn) => fn());
    }

    return response;
  });
};

export const transaction = <T>(
  fn: () => T,
  attributes?: Record<string, unknown>
): Promise<Awaited<T>> => {
  return wrapTransaction((context) => {
    return Promise.all([fn(), awaitTransaction(context.promises)])
      .catch((err) => {
        context.onError.forEach((fn) => fn());
        throw err;
      })
      .then(([res]) => {
        context.onSuccess.forEach((fn) => fn());
        return res;
      });
  }, attributes);
};

export const maybeTransaction = <T>(fn: () => T, request?: ProxyRequest): T => {
  const isRootTransaction =
    !getRequestContext(request)?.transaction && !getSyncTransactionContext();
  if (isRootTransaction) {
    return syncTransaction(fn);
  }
  return fn();
};
