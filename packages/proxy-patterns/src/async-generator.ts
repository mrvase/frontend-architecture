export function createPushableAsyncGenerator<T>() {
  let queue: T[] = [];
  let pendingResolvers: ((value: IteratorResult<T>) => void)[] = [];
  let isDone = false;

  const push = (value: T) => {
    if (isDone) return;
    if (pendingResolvers.length) {
      const resolve = pendingResolvers.shift();
      resolve!({ value, done: false });
    } else {
      queue.push(value);
    }
  };

  const close = () => {
    isDone = true;
    while (pendingResolvers.length) {
      const resolve = pendingResolvers.shift();
      resolve!({ value: undefined, done: true });
    }
  };

  async function* generator() {
    while (!isDone || queue.length > 0) {
      if (queue.length > 0) {
        yield queue.shift()!;
      } else {
        const result = await new Promise<IteratorResult<T>>((resolve) =>
          pendingResolvers.push(resolve)
        );
        if (!result.done) {
          yield result.value;
        }
      }
    }
  }

  return {
    push,
    close,
    generator: generator(),
  };
}
