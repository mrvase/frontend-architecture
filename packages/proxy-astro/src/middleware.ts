import { defineMiddleware } from "astro/middleware";

export const dehydrateQueryClientMiddleware = (
  getHydrateData: () => Map<string, unknown>
) =>
  defineMiddleware(async (_, next) => {
    const hydrateData = getHydrateData();
    const response = await next();

    // Only proceed if the response is an HTML document
    if (!response.headers.get("content-type")?.includes("text/html")) {
      return response;
    }

    let prev = 0;
    let hasBody = false;
    const queue: string[] = [];

    // Create a TransformStream to modify the HTML as it streams
    const { readable, writable } = new TransformStream({
      transform(chunk: Uint8Array, controller) {
        const chunkText = new TextDecoder().decode(chunk);
        let modifiedChunk = chunkText;

        const length = hydrateData.size;

        if (prev < length) {
          const json = JSON.stringify(
            Array.from(hydrateData.entries()).splice(prev)
          );

          queue.push(json);

          prev = length;
        }

        if (modifiedChunk.includes("<body")) {
          hasBody = true;
        }

        if (hasBody && queue.length > 0) {
          queue.forEach((json) => {
            if (modifiedChunk.includes("<body")) {
              modifiedChunk = modifiedChunk.replace(
                "<body>",
                `<body><script data-proxy-state type="application/json">${json}</script>`
              );
            } else {
              modifiedChunk = `<script data-proxy-state type="application/json">${json}</script>${modifiedChunk}`;
            }
          });
          queue.length = 0;
        }

        // Enqueue the modified chunk
        controller.enqueue(new TextEncoder().encode(modifiedChunk));
      },
    });

    // Connect the original response body to the TransformStream
    void response.body?.pipeTo(writable);

    // Return a new response with the transformed readable stream as body
    return new Response(readable, response);
  });
