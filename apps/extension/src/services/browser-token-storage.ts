import { browser } from "wxt/browser";

import type { TokenStorage } from "@/src/services/token-storage";

const STORAGE_KEY = "syncron:auth-token";

// chrome.storage.local: persists across browser restarts (standard "stay
// signed in" UX), isolated per-extension by the browser, cleared on
// sign-out. See docs/extension-architecture.md §12 — session material is
// allowed here "only as required by Better Auth's safe integration design".
export function createLocalTokenStorage(): TokenStorage {
  return {
    async get() {
      const stored = await browser.storage.local.get(STORAGE_KEY);
      const value = stored[STORAGE_KEY];
      return typeof value === "string" ? value : null;
    },
    async set(token: string) {
      await browser.storage.local.set({ [STORAGE_KEY]: token });
    },
    async clear() {
      await browser.storage.local.remove(STORAGE_KEY);
    },
  };
}
