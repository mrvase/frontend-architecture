import { useSyncExternalStore } from "react";
import { Hydrate } from "@nanokit/proxy-signals/react";

let browserData = new Map<string, unknown>();

const updateData = () => {
  let updated = false;

  document.querySelectorAll("[data-proxy-state]").forEach((el) => {
    const value = JSON.parse(el.innerHTML) as [string, unknown][];
    value.forEach(([key, value]) => {
      if (!browserData.has(key)) {
        updated = true;
      }
      browserData.set(key, value);
    });
  });
  if (updated) {
    browserData = new Map(browserData);
  }
};

/*#__NO_SIDE_EFFECTS__*/
export function HydrateAstro({
  children,
  data: serverSideData,
}: {
  children?: React.ReactNode;
  data: Map<string, unknown>;
}) {
  const data = useSyncExternalStore(
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    () => () => {},
    () => {
      updateData();
      return browserData;
    },
    () => {
      if (typeof document === "undefined") {
        return serverSideData;
      }
      updateData();
      return browserData;
    }
  );

  return <Hydrate data={data}>{children}</Hydrate>;
}
