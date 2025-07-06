export const orderedJsonStringify = (obj: unknown) =>
  JSON.stringify(obj, (_, val) =>
    typeof val === "object" && val !== null && !Array.isArray(val)
      ? Object.keys(val)
          .sort()
          .reduce((result, key) => {
            result[key] = val[key];
            return result;
          }, {} as Record<string, unknown>)
      : val
  );
