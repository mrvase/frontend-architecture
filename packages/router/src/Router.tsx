import React, { useMemo, useState } from "react";
import type { History, HistoryState, NavigateOptions, To } from "./types";
import { createHistory } from "./history";

export const HistoryContext = React.createContext<History>(null!);
export const useHistory = () => React.useContext(HistoryContext);

export const RouterStateContext = React.createContext<HistoryState>(null!);
export const useLocation = () => React.useContext(RouterStateContext).location;
export const useAction = () => React.useContext(RouterStateContext).action;
export const useRouterIsLoading = () => React.useContext(RouterStateContext).isLoading;
export const useNavigate = () => React.useContext(HistoryContext).navigate;

export function Router({
  children,
  history: historyFromArg,
}: {
  children?: React.ReactNode;
  history?: History;
}) {
  const history = useMemo(() => historyFromArg ?? createHistory(), [historyFromArg]);
  const state = React.useSyncExternalStore(...history.sync());

  return (
    <HistoryContext.Provider value={history}>
      <RouterStateContext.Provider value={state}>{children}</RouterStateContext.Provider>
    </HistoryContext.Provider>
  );
}
