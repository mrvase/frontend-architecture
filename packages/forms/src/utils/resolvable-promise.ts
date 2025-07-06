export type ResolvablePromise<T> = Promise<T> & {
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

export const createResolvablePromise = <T>(): ResolvablePromise<T> => {
  let resolve: (value: T) => void;
  let reject: (error: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    let isResolved = false;
    resolve = (value) => {
      if (isResolved) return;
      isResolved = true;
      res(value);
    };
    reject = rej;
  }) as ResolvablePromise<T>;

  return Object.assign(promise, {
    resolve: resolve!,
    reject: reject!,
  });
};
