import { createAuthClient } from "better-auth/client";
import { emailOTPClient } from "better-auth/client/plugins";
import { storage } from "wxt/utils/storage";

// docker-compose.yml maps the API container to host port 3001 in dev.
// Override via a WXT env file (WXT_API_URL) for other environments.
const API_BASE_URL = import.meta.env.WXT_API_URL ?? "http://localhost:3001";

export const AUTH_TOKEN_KEY = "local:authToken" as const;

// The backend mounts Better Auth with the `bearer()` plugin (see
// packages/auth/src/index.ts) instead of relying on cookies, since a
// popup's storage partition isn't a normal browser cookie jar. Bearer
// sessions hand back a `set-auth-token` response header on success; we
// persist it in extension-local storage and re-attach it as
// `Authorization: Bearer <token>` on every subsequent request.
export const authClient = createAuthClient({
  baseURL: API_BASE_URL,
  basePath: "/api/auth",
  plugins: [emailOTPClient()],
  fetchOptions: {
    auth: {
      type: "Bearer",
      token: async () => (await storage.getItem<string>(AUTH_TOKEN_KEY)) ?? undefined,
    },
    onSuccess: async (ctx) => {
      const token = ctx.response.headers.get("set-auth-token");
      if (token) await storage.setItem(AUTH_TOKEN_KEY, token);
    },
  },
});

export async function getStoredToken(): Promise<string | null> {
  return (await storage.getItem<string>(AUTH_TOKEN_KEY)) ?? null;
}

export async function clearStoredSession(): Promise<void> {
  await storage.removeItem(AUTH_TOKEN_KEY);
}

export function watchStoredSession(onChange: () => void): () => void {
  return storage.watch<string>(AUTH_TOKEN_KEY, onChange);
}
