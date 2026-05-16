import { vi, afterEach } from "vitest";

if (typeof window !== "undefined" && !window.sessionStorage) {
  const store = new Map<string, string>();
  Object.defineProperty(window, "sessionStorage", {
    value: {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => void store.set(k, String(v)),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
    },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});
