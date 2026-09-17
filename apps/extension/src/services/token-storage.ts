// Small seam so auth-client.ts / api-client.ts stay framework-agnostic and
// testable outside the extension runtime (see tests/extension-auth-flow.test.ts,
// which exercises the real client against an in-process backend using the
// in-memory implementation below — no WXT/browser global available there).
// The real chrome.storage.local-backed implementation lives in
// browser-token-storage.ts, which only entrypoints import.
export interface TokenStorage {
  get(): Promise<string | null>;
  set(token: string): Promise<void>;
  clear(): Promise<void>;
}

export function createInMemoryTokenStorage(): TokenStorage {
  let token: string | null = null;
  return {
    async get() {
      return token;
    },
    async set(next: string) {
      token = next;
    },
    async clear() {
      token = null;
    },
  };
}
