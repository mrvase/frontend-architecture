export function createContext(name) {
  throw new Error(
    `Tried creating an async context outside node with name: ${name}`
  );
}

export function getContext(name) {
  throw new Error(
    `Tried getting an async context outside node with name: ${name}`
  );
}
