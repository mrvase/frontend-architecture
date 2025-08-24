import {
  createProxyRequest,
  getRequestType,
  type JsonValue,
  type ProxyRequest,
} from "@nanokit/proxy";

export type WebRequestContext =
  | {
      type: "error";
      status: 400 | 404 | 405;
      statusText: string;
    }
  | {
      type: "query" | "mutate" | "dispatch";
      request: ProxyRequest;
    };

const queryParamName = "input";

export function getWebRequestFromProxyRequest(
  event: ProxyRequest,
  origin: string = ""
): {
  url: string;
  init: RequestInit;
} {
  const type = getRequestType();

  if (event.payload[0] instanceof File) {
    const [file, ...rest] = event.payload;
    const queryString = rest.map((el) => `${queryParamName}=${JSON.stringify(el)}`).join("&");
    const url = [`${origin}/proxy/${event.type.join("/")}`, queryString].filter(Boolean).join("?");

    return {
      url,
      init: {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": "application/octet-stream",
        },
      },
    };
  }

  if (type === "mutate") {
    const url = `${origin}/proxy/${event.type.join("/")}`;
    return {
      url,
      init: {
        method: "POST",
        body: JSON.stringify(event.payload),
        headers: {
          "Content-Type": "application/json",
        },
      },
    };
  }

  const queryString = event.payload
    .map((el) => `${queryParamName}=${JSON.stringify(el)}`)
    .join("&");
  const url = [`${origin}/proxy/${event.type.join("/")}`, queryString].filter(Boolean).join("?");

  return { url, init: {} };
}

export async function getProxyRequestFromWebRequest(request: Request): Promise<WebRequestContext> {
  if (request.method === "GET") {
    const url = new URL(request.url);

    if (!url.pathname.startsWith("/proxy/")) {
      throw new Error("Invalid path");
    }

    const path = url.pathname.replace(/^\/proxy\//, "");
    const type = path.split("/");

    const payloadStringified = url.searchParams.getAll(queryParamName);
    if (!payloadStringified) {
      return { type: "error", status: 400, statusText: "Bad request" };
    }

    try {
      const payload = payloadStringified.map((string) =>
        string === "undefined" ? undefined : (JSON.parse(string) as JsonValue)
      );

      return { type: "query", request: createProxyRequest(type, payload) };
    } catch (err) {
      console.log(err);
      return { type: "error", status: 400, statusText: "Bad request" };
    }
  }

  if (request.method === "POST") {
    const url = new URL(request.url);

    if (!url.pathname.startsWith("/proxy/")) {
      throw new Error("Invalid path");
    }

    const path = url.pathname.replace(/^\/proxy\//, "");
    const type = path.split("/");

    const payload = (await request.json()) as JsonValue[];

    try {
      return { type: "mutate", request: createProxyRequest(type, payload) };
    } catch (err) {
      console.log(err);
      return { type: "error", status: 400, statusText: "Bad request" };
    }
  }

  if (request.method === "PUT") {
    const url = new URL(request.url);

    if (!url.pathname.startsWith("/proxy/")) {
      throw new Error("Invalid path");
    }

    const path = url.pathname.replace(/^\/proxy\//, "");
    const type = path.split("/");

    const payloadStringified = url.searchParams.getAll(queryParamName);
    if (!payloadStringified) {
      return { type: "error", status: 400, statusText: "Bad request" };
    }

    const file = await request.arrayBuffer();

    try {
      const payloadRest = payloadStringified.map((string) =>
        string === "undefined" ? undefined : (JSON.parse(string) as JsonValue)
      );

      return {
        type: "mutate",
        request: createProxyRequest(type, [file, ...payloadRest]),
      };
    } catch (err) {
      console.log(err);
      return { type: "error", status: 400, statusText: "Bad request" };
    }
  }

  return { type: "error", status: 405, statusText: "Method not allowed" };
}
