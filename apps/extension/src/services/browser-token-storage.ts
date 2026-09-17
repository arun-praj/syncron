import { browser } from "wxt/browser";

import type { TokenStorage } from "@/src/services/token-storage";

const STORAGE_KEY = "syncron:auth-token";
const PENDING_VERIFICATION_KEY = "syncron:pending-verification";

export interface PendingVerification {
  email: string;
  expiresAt: number;
}

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

export async function getPendingVerification(): Promise<PendingVerification | null> {
  const stored = await browser.storage.local.get(PENDING_VERIFICATION_KEY);
  const value = stored[PENDING_VERIFICATION_KEY];
  if (!value || typeof value !== "object") return null;
  const { email, expiresAt } = value as Partial<PendingVerification>;
  return typeof email === "string" && typeof expiresAt === "number"
    ? { email, expiresAt }
    : null;
}

export function setPendingVerification(value: PendingVerification): Promise<void> {
  return browser.storage.local.set({ [PENDING_VERIFICATION_KEY]: value });
}

export function clearPendingVerification(): Promise<void> {
  return browser.storage.local.remove(PENDING_VERIFICATION_KEY);
}
