import { createContext } from "react";

export const SyncContext = createContext<(<T>(fn: () => T) => T) | null>(null);

export const FormSyncContextProvider = ({
  children,
  context,
}: {
  children: React.ReactNode;
  context: <T>(fn: () => T) => T;
}) => {
  return (
    <SyncContext.Provider value={context}>{children}</SyncContext.Provider>
  );
};
