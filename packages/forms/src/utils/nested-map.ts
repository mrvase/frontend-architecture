export type NestedMap<K extends readonly unknown[], V> = K extends [
  infer H,
  ...infer T
]
  ? Map<H, NestedMap<T, V>>
  : V;

/*
export class TupleMap<K extends readonly unknown[], V> {
  private readonly root = new Map<unknown, unknown>();

  get(keys: K): V | undefined {
    let node: unknown = this.root;
    for (const key of keys) {
      if (!(node instanceof Map)) return undefined;
      node = node.get(key);
    }
    return node as V | undefined;
  }

  set(keys: K, value: V): void {
    const last = keys.length - 1;
    let node: Map<unknown, unknown> = this.root;

    for (let i = 0; i < last; i++) {
      const key = keys[i];
      let next = node.get(key);
      if (!(next instanceof Map)) {
        next = new Map();
        node.set(key, next);
      }
      node = next as Map<unknown, unknown>;
    }
    node.set(keys[last], value);
  }

  has(keys: K): boolean {
    return this.get(keys) !== undefined;
  }

  delete(keys: K): boolean {
    const parents: Map<unknown, unknown>[] = [];
    let node: unknown = this.root;

    for (const key of keys) {
      if (!(node instanceof Map)) return false;
      parents.push(node);
      node = node.get(key);
    }
    if (parents.length === 0) return false;
    const lastMap = parents.pop()!;
    const removed = lastMap.delete(keys[keys.length - 1]);

    // clean up empty intermediate maps
    for (let i = parents.length - 1; i >= 0; i--) {
      const map = parents[i];
      const key = keys[i];
      const child = map.get(key);
      if (child instanceof Map && child.size === 0) map.delete(key);
      else break;
    }
    return removed;
  }
}
*/
