import type { APIRoute } from "astro";
import { getProxyRequestFromWebRequest } from "@nanokit/proxy-patterns/web-request";
import { handleRequest } from "src/shared/core/server/request";
import type { HandlerNode } from "@nanokit/proxy";

export const prerender = false;

const handlers: HandlerNode = [];

export const ALL: APIRoute = async ({ request }) => {
  const proxyRequest = await getProxyRequestFromWebRequest(request);

  if (proxyRequest.type === "error") {
    return new Response(proxyRequest.statusText, {
      status: proxyRequest.status,
      statusText: proxyRequest.statusText,
    });
  }

  return handleRequest(handlers, request, proxyRequest, {
    secret: "abcd",
  });
};
