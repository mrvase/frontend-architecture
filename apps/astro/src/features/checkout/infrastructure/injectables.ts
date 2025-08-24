import type { Inject } from "@nanokit/proxy";
import { createRepository } from "@nanokit/proxy-patterns/repository";
import { signalPlugin } from "@nanokit/proxy-signals";

export const injectables = {} as const satisfies Inject.InjectableRecord;

declare module "@nanokit/proxy" {
  interface Injectables extends Inject.InferInjectables<typeof injectables> {}
}
