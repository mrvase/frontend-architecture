import type { JsonValue, RequestFn } from "@nanokit/proxy";
import { getWebRequestFromProxyRequest } from "@nanokit/proxy-patterns/web-request";

async function* getStream(response: Response): AsyncGenerator<any> {
  if (!response.ok || !response.body) {
    throw new Error("Failed to fetch stream");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let expectedLength: number | null = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    while (true) {
      if (expectedLength === null) {
        const index = buffer.indexOf("\n");
        if (index === -1) break;
        const lengthLine = buffer.slice(0, index).trim();
        expectedLength = parseInt(lengthLine, 10);
        if (isNaN(expectedLength)) {
          throw new Error(`Invalid length prefix: "${lengthLine}"`);
        }
        buffer = buffer.slice(index + 1);
      }

      if (buffer.length < expectedLength) break;

      const message = buffer.slice(0, expectedLength);
      buffer = buffer.slice(expectedLength);
      expectedLength = null;

      yield JSON.parse(message);
    }
  }
}

function wrapMaybeAsyncIterable(promise: Promise<JsonValue | void>) {
  let cached: unknown;
  let resolved = false;

  const nextPromise = promise.then((result) => {
    cached = result;
    resolved = true;
    return result;
  });

  const wrapped: Promise<JsonValue | void> & AsyncIterable<JsonValue | void> = {
    then: <TResult1 = JsonValue | void, TResult2 = never>(
      onfulfilled?:
        | ((value: JsonValue | void) => TResult1 | PromiseLike<TResult1>)
        | null
        | undefined,
      onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null | undefined
    ) => {
      return nextPromise.then(onfulfilled, onrejected);
    },

    catch<TResult = never>(
      onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null | undefined
    ) {
      return nextPromise.catch(onrejected);
    },

    finally(onFinally: () => void) {
      return nextPromise.finally(onFinally);
    },

    get [Symbol.toStringTag]() {
      return nextPromise[Symbol.toStringTag];
    },

    [Symbol.asyncIterator]: async function* () {
      const value = resolved ? cached : await promise;

      if (value && typeof value === "object" && Symbol.asyncIterator in value) {
        yield* value as AsyncGenerator<JsonValue | void>;
      } else {
        yield value as JsonValue | void;
      }
    },
  };

  return wrapped;
}

const apiProxyRequestFn: RequestFn = (event) => {
  const { url, init } = getWebRequestFromProxyRequest(event);

  const promise = fetch(url, init).then((response) => {
    if (!response.ok) {
      throw new Error(`[${init.method} ${response.status}] ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type");

    if (contentType?.includes("text/event-stream")) {
      return getStream(response);
    }

    return response.json();
  });

  return wrapMaybeAsyncIterable(promise);
};

export const apiProxy = <T>(): T => apiProxyRequestFn as T;
