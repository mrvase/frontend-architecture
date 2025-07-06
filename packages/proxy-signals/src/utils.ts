import type { ProxyRequest } from "@nanokit/proxy";

function hashKeyElement(queryKey: unknown): string {
  return JSON.stringify(queryKey, (_, val) =>
    typeof val === "object" && val !== null
      ? Object.keys(val)
          .sort()
          .reduce((result, key) => {
            result[key] = val[key];
            return result;
          }, {} as any)
      : val
  );
}

const getSymbolDescription = (symbol: symbol) => {
  const description = symbol.description;
  if (!description) {
    throw new Error(
      "Symbols in queries must have a description for SSR purposes."
    );
  }
  return description;
};

const getSymbolKey = (symbol: symbol, record?: Map<string, symbol>) => {
  const description = getSymbolDescription(symbol);
  if (!record) {
    return description;
  }
  let match = record.get(description);
  if (!match) {
    record.set(description, symbol);
  } else if (match !== symbol) {
    throw new Error(
      `Symbol description "${description}" is already in use. Descriptions must be unique for SSR purposes.`
    );
  }
  return description;
};

const hashKey = (key: unknown[], record?: Map<string, symbol>) => {
  return key
    .map((el) => {
      if (typeof el === "symbol") {
        return hashKeyElement(getSymbolKey(el, record));
      }
      return hashKeyElement(el);
    })
    .join(",");
};

export const getKey = (request: ProxyRequest, record?: Map<string, symbol>) => {
  return hashKey([...request.type, ...request.payload], record);
};

// inspired by https://github.com/epoberezkin/fast-deep-equal
export const deepEquals = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;

  if (a && b && typeof a == "object" && typeof b == "object") {
    if (a instanceof Promise && b instanceof Promise) {
      return false;
    }

    if (a.constructor !== b.constructor) return false;

    var length, i, keys;
    if (Array.isArray(a)) {
      length = a.length;
      if (length != (b as any[]).length) return false;
      for (i = length; i-- !== 0; )
        if (!deepEquals(a[i], (b as any[])[i])) return false;
      return true;
    }

    if (a.valueOf !== Object.prototype.valueOf)
      return a.valueOf() === b.valueOf();
    if (a.toString !== Object.prototype.toString)
      return a.toString() === b.toString();

    keys = Object.keys(a);
    length = keys.length;
    if (length !== Object.keys(b).length) return false;

    for (i = length; i-- !== 0; )
      if (!Object.prototype.hasOwnProperty.call(b, keys[i])) return false;

    for (i = length; i-- !== 0; ) {
      var key = keys[i];

      if (!deepEquals(a[key as keyof typeof a], b[key as keyof typeof b]))
        return false;
    }

    return true;
  }

  // true if both NaN, false otherwise
  return a !== a && b !== b;
};
