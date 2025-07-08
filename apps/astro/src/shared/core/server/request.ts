import {
  createInvokers,
  Inject,
  transaction,
  type HandlerNode,
  type ProxyRequest,
} from "@nanokit/proxy";
import {
  createRequestCookieRepository,
  createResponseCookieRepository,
  RequestCookieRepository,
  ResponseCookieRepository,
} from "./cookies";
import type { WebRequestContext } from "@nanokit/proxy-patterns/web-request";
import { getHandlers } from "@nanokit/proxy/internal";

export const RequestAdapter = Symbol("RequestAdapter");
export type RequestAdapter = {
  setStatus: (status: number) => void;
  setHeaders: (headers: Record<string, string>) => void;
  getStatus: () => number;
  getHeaders: () => Headers;
};

export async function createRequestInjectables(
  request: Request,
  options: { secret?: string } = {}
) {
  let status = 200;
  const repsonseHeaders = new Headers();

  const requestCookieRepository = await createRequestCookieRepository(
    request.headers.get("cookie") || "",
    options.secret
  );
  const responseCookieRepository = createResponseCookieRepository(
    repsonseHeaders,
    options.secret
  );

  const handlers = {
    [RequestAdapter]: {
      setStatus(value) {
        status = value;
      },
      setHeaders(value) {
        Object.entries(value).forEach(([key, value]) => {
          repsonseHeaders.set(key, value);
        });
      },
      getStatus() {
        return status;
      },
      getHeaders() {
        return repsonseHeaders;
      },
    } satisfies RequestAdapter,
    [RequestCookieRepository]: requestCookieRepository,
    [ResponseCookieRepository]: responseCookieRepository,
  };

  return handlers;
}

export async function handleQueryRequest<T>(
  handlers: HandlerNode,
  request: Request,
  proxyRequest: ProxyRequest<T>,
  options: { secret?: string } = {}
) {
  const injectables = await createRequestInjectables(request, options);
  const invokers = createInvokers([
    handlers,
    { [Inject.private]: injectables },
  ]);

  try {
    const data = await transaction(() => invokers.mutate(proxyRequest));

    const status = injectables[RequestAdapter].getStatus();
    const headers = injectables[RequestAdapter].getHeaders();

    return {
      data,
      status,
      headers,
    };
  } catch (err) {
    console.error("Error in handler", err);
    const status = injectables[RequestAdapter].getStatus();
    const headers = injectables[RequestAdapter].getHeaders();

    return {
      data: null,
      status,
      headers,
    };
  }
}

function isAsyncGenerator(obj: unknown): obj is AsyncGenerator<unknown> {
  return obj !== null && typeof obj === "object" && Symbol.asyncIterator in obj;
}

const createReadableStream = () => {
  const encoder = new TextEncoder();
  let controllerRef: ReadableStreamDefaultController | null = null;
  let isOpen = true;

  const cleanup = () => {
    isOpen = false;
    controllerRef = null;
    clearTimeout(timeout);
  };

  const close = () => {
    if (!isOpen) {
      return;
    }

    try {
      controllerRef?.close();
    } catch (err) {}
    cleanup();
  };

  const timeout = setTimeout(close, 60000);

  const stream = new ReadableStream({
    start(controller) {
      controllerRef = controller;
    },
    cancel() {
      cleanup();
    },
  });

  return Object.assign(stream, {
    push: (message: unknown) => {
      const json = JSON.stringify(message);
      return controllerRef?.enqueue(encoder.encode(`${json.length}\n${json}`));
    },
    close,
  });
};

export async function handleRequest(
  handlers: HandlerNode,
  request: Request,
  proxyRequest: WebRequestContext,
  options: { secret?: string } = {}
) {
  if (proxyRequest.type === "error") {
    return new Response(proxyRequest.statusText, {
      status: proxyRequest.status,
      statusText: proxyRequest.statusText,
    });
  }

  if (
    proxyRequest.type !== "dispatch" &&
    !getHandlers(proxyRequest.request, handlers).length
  ) {
    return new Response("Not found", { status: 404 });
  }

  const injectables = await createRequestInjectables(request, options);

  const invokers = createInvokers([
    handlers,
    { [Inject.private]: injectables },
  ]);

  try {
    const data = await transaction(() =>
      invokers[proxyRequest.type](proxyRequest.request)
    );

    const status = injectables[RequestAdapter].getStatus();
    const headers = injectables[RequestAdapter].getHeaders();
    headers.set("Content-Type", "application/json");

    if (data instanceof ReadableStream) {
      return new Response(data, {
        status,
        headers,
      });
    }

    if (isAsyncGenerator(data)) {
      const stream = createReadableStream();

      (async () => {
        for await (const message of data) {
          stream.push(message);
        }
        stream.close();
      })();

      return new Response(stream, {
        status,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    let body =
      data instanceof ReadableStream ? data : JSON.stringify(data ?? null);
    return new Response(body, {
      status,
      headers,
    });
  } catch (err) {
    console.error("Error in handler", err);
    const status = injectables[RequestAdapter].getStatus();
    return new Response(null, {
      status: status >= 400 ? status : 500,
      statusText: err instanceof Error ? err.message : "Unexpected error",
    } satisfies ResponseInit);
  }
}
