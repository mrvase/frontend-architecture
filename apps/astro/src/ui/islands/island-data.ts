import type { ProxyRequest } from "@nanokit/proxy";

export async function fetchIslandData(
  ...islands: {
    prefetch: ProxyRequest[] | undefined;
    query: <T>(request: ProxyRequest<T>) => T;
  }[]
) {
  const promises = islands.flatMap((island) => {
    return island.prefetch?.map((request) => island.query(request));
  });

  return await Promise.all(promises).then(() => {});
}
