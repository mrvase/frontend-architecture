import type { Inject } from "@nanokit/proxy";

export async function fetchIslandData(
  ...islands: {
    prefetch: Inject.ProxyRequest[] | undefined;
    query: <T extends Inject.RequestValue>(request: Inject.ProxyRequest<T>) => T;
  }[]
) {
  const promises = islands.flatMap((island) => {
    return island.prefetch?.map((request) => island.query(request));
  });

  return await Promise.all(promises).then(() => {});
}
