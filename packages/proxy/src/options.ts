import { type RequestOptions } from "./context";

let OptionsContext: RequestOptions | undefined = undefined;

export const getOptionsContext = () => OptionsContext;

const trackOptionsContext = <T>(options: RequestOptions, fn: () => T): T => {
  const prevOptionsContext = OptionsContext;

  try {
    OptionsContext = options;

    return fn();
  } finally {
    OptionsContext = prevOptionsContext;
  }
};

export const noCache = <T>(fn: () => T): T => {
  return trackOptionsContext({ noCache: true }, fn);
};
