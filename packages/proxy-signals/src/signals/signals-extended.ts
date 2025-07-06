import { Reactive } from "./signals";

export class ReactiveExtended<T> extends Reactive<T> {
  disposed = false;
  fn_: (() => T) | undefined;
  effect_: boolean;

  constructor(fn: (() => T) | undefined, effect?: boolean, label?: string) {
    super(fn as T, effect, label);
    this.fn_ = fn;
    this.effect_ = effect || false;
  }

  override get(parent?: ReactiveExtended<any>): T {
    if (this.disposed && !this.effect_) {
      throw new Error("ReactiveExtended has been disposed");
    }

    if (parent && !this["observers"]?.includes(parent)) {
      this["observers"] = this["observers"] || [];
      this["observers"].push(parent);
      parent["sources"] = parent["sources"] || [];
      parent["sources"].push(this);
    }

    return super.get();
  }

  override set(fn: () => T) {
    this.fn_ = fn;
    return super.set(fn);
  }

  isDisposable() {
    return !this["observers"] || this["observers"].length === 0;
  }

  dispose() {
    if (this.disposed) {
      return;
    }
    this["removeParentObservers"](0);
    this.removeChildSources();
    this["sources"] = null;
    this["observers"] = null;
    this["fn"] = undefined;
    // this automatically removes sources and parent observers
    // super.set(undefined as T);
    this.disposed = true;
  }

  refresh() {
    super.set(() => this.fn_?.() as T);
  }

  private removeChildSources(): void {
    if (!this["observers"]) return;
    for (let i = 0; i < this["observers"].length; i++) {
      const observer: Reactive<any> = this["observers"][i]; // We don't actually delete sources here because we're replacing the entire array soon
      const swap = observer["sources"]!.findIndex((v) => v === this);
      observer["sources"]![swap] = observer["sources"]![observer["sources"]!.length - 1];
      observer["sources"]!.pop();
    }
  }
}
