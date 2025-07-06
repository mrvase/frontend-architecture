export interface Path {
  pathname: string;
  search: string;
  hash: string;
}

export type To = string | Partial<Path>;

export interface Location extends Path {
  /**
   * A value of arbitrary data associated with this location.
   */
  state: any;

  /**
   * A unique string associated with this location. May be used to safely store
   * and retrieve data in some other storage API, like `localStorage`.
   *
   * Note: This value is always "default" on the initial location.
   */
  key: string;
}

export type Action = "POP" | "PUSH" | "REPLACE";

export interface BaseState {
  action: Action;
  location: Location;
}

export interface Listener {
  (update: BaseState, oldState: BaseState): void;
}

export type HistoryState = {
  action: Action;
  location: Location;
  isLoading: boolean;
  pending: Location | undefined;
};

export interface History {
  readonly action: Action;
  readonly location: Location;

  /**
   * Sets up a listener that will be called whenever the current location
   * changes.
   *
   * @param listener - A function that will be called when the location changes
   * @returns unlisten - A function that may be used to stop listening
   */
  listen(listener: Listener): () => void;

  sync(): [(listener: Listener) => () => void, () => HistoryState];

  /**
   * Pushes a new location onto the history stack, increasing its length by one.
   * If there were any entries in the stack after the current one, they are
   * lost.
   *
   * @param to - The new URL
   * @param state - Data to associate with the new location
   */
  push(to: Location): void;

  /**
   * Replaces the current location in the history stack with a new one.  The
   * location that was replaced will no longer be available.
   *
   * @param to - The new URL
   * @param state - Data to associate with the new location
   */
  replace(to: Location): void;

  navigate(to: To, options?: NavigateOptions): Location;

  /**
   * Navigates `n` entries backward/forward in the history stack relative to the
   * current index. For example, a "back" navigation would use go(-1).
   *
   * @param delta - The delta in the stack index
   */
  go(delta: number): void;
}

export interface NavigateOptions {
  replace?: boolean;
  scroll?: boolean;
  state?: any;
  navigate?: boolean;
}
