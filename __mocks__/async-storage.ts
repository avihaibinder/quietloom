/**
 * Test stub for `@react-native-async-storage/async-storage`.
 *
 * WHY THIS EXISTS
 * `src/core/store.ts` has a *value* import of AsyncStorage, which is a native
 * module and cannot load in plain Node. Every module that persists anything —
 * `src/services/entitlements.ts` above all — is unreachable without this.
 *
 * WHY IT IS A REAL IMPLEMENTATION AND NOT A SPY
 * The CEO's lead 5: "a test that asserts a mock was called proves nothing."
 * So this is a working in-memory key/value store with AsyncStorage's exact
 * async semantics, not a bag of `vi.fn()`s. Tests assert on outcomes — did the
 * night pass actually expire — never on "setItem was called".
 *
 * Wired in by `resolve.alias` in vitest.config.ts. Metro never sees this file.
 */

const store = new Map<string, string>();

/** Test-only: wipe between cases. Not part of the AsyncStorage API. */
export function __resetAsyncStorage(): void {
  store.clear();
}

/** Test-only: inspect raw persisted bytes without going through the cache. */
export function __rawAsyncStorage(): Map<string, string> {
  return new Map(store);
}

const AsyncStorage = {
  async getItem(key: string): Promise<string | null> {
    return store.has(key) ? (store.get(key) as string) : null;
  },

  async setItem(key: string, value: string): Promise<void> {
    store.set(key, String(value));
  },

  async removeItem(key: string): Promise<void> {
    store.delete(key);
  },

  async multiGet(keys: readonly string[]): Promise<[string, string | null][]> {
    return keys.map((k) => [k, store.has(k) ? (store.get(k) as string) : null]);
  },

  async multiSet(pairs: readonly [string, string][]): Promise<void> {
    for (const [k, v] of pairs) store.set(k, String(v));
  },

  async multiRemove(keys: readonly string[]): Promise<void> {
    for (const k of keys) store.delete(k);
  },

  async getAllKeys(): Promise<string[]> {
    return [...store.keys()];
  },

  async clear(): Promise<void> {
    store.clear();
  },
};

export default AsyncStorage;
