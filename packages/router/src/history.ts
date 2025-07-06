import type { Location, Listener, History, HistoryState, NavigateOptions, To, Path } from "./types";
import { createKey, createPath, resolveTo } from "./utils";

export function createHistory(options: { window?: Window } = {}) {
  let state: HistoryState = {
    action: "POP",
    location: getLocation(),
    isLoading: true,
    pending: undefined,
  };

  let current = createKey();

  function setState(newState: Pick<HistoryState, "action" | "location">, initial?: boolean) {
    const key = newState.location.key;
    current = key;

    const set = (newState: HistoryState) => {
      if (current !== key) return;
      let oldState = state;
      state = newState;
      if (!initial) {
        listeners.forEach((listener) => listener(newState, oldState));
      }
    };

    set({
      ...newState,
      isLoading: false,
      pending: undefined,
    });
  }

  let listeners = new Set<Listener>();

  function handleAction(actionFromArg: "PUSH" | "REPLACE", location: Location) {
    const globalHistory = (options.window ?? document.defaultView!).history;

    const historyState = {
      usr: location.state,
      key: location.key,
    };

    const url = createPath(location);

    try {
      const method = actionFromArg === "PUSH" ? "pushState" : "replaceState";
      globalHistory[method](historyState, "", url);
    } catch (error) {
      // iOS has a limit of 100 pushState calls
      window.location.assign(url);
    }

    setState({
      action: actionFromArg,
      location,
    });
  }

  function handlePop() {
    setState({
      action: "POP",
      location: getLocation(),
    });
  }

  function listen(fn: Listener) {
    const window = options.window ?? document.defaultView!;

    if (listeners.size === 0) {
      window.addEventListener("popstate", handlePop);
    }
    listeners.add(fn);

    return () => {
      listeners.delete(fn);
      if (listeners.size === 0) {
        window.removeEventListener("popstate", handlePop);
      }
    };
  }

  function getLocation() {
    const globalHistory = (options.window ?? document.defaultView!).history;
    const { pathname, search, hash } = window.location;
    return {
      pathname,
      search,
      hash,
      // state defaults to `null` because `window.history.state` does
      state: (globalHistory.state && globalHistory.state.usr) || null,
      key: (globalHistory.state && globalHistory.state.key) || "default",
    };
  }

  function navigate(to: To, options: NavigateOptions = {}) {
    const { navigate = true, replace = false, state: historyState = null } = options;
    let path: Path & Partial<Location> = resolveTo(to, state.location.pathname);

    if (navigate) {
      path.key = createKey();
      path.state = historyState;
      handleAction(replace ? "REPLACE" : "PUSH", path as Location);
    }

    return path as Location;
  }

  const history: History = {
    get action() {
      return state.action;
    },
    get location() {
      return state.location;
    },
    listen,
    sync() {
      return [listen, () => state];
    },
    push(location) {
      handleAction("PUSH", location);
    },
    replace(location) {
      handleAction("REPLACE", location);
    },
    navigate,
    go(n) {
      const globalHistory = (options.window ?? document.defaultView!).history;
      return globalHistory.go(n);
    },
  };

  // we queue this initial loader call so that loaders can call `push` or `replace`
  // from the history object
  queueMicrotask(() => setState(state, true));

  return history;
}
