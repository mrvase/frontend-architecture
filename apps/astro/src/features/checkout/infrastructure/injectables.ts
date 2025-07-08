import type { InferInjectables, InjectableRecord } from "@nanokit/proxy";
import { createRepository } from "@nanokit/proxy-patterns/repository";
import { signalPlugin } from "@nanokit/proxy-signals";

export const injectables = {} as const satisfies InjectableRecord;

declare module "@nanokit/proxy" {
  interface Injectables extends InferInjectables<typeof injectables> {}
}
