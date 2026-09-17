import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, expect, test, vi } from "vitest";
import { serve } from "@hono/node-server";
import { openDatabase } from "../packages/db/src/index.js";
import { config } from "../packages/config/src/index.js";
import { createAuth, type Mail } from "../packages/auth/src/index.js";
import { createApp } from "../apps/api/src/app.js";
import type { MediaService } from "../apps/api/src/livekit.js";
import { createApiClient } from "../apps/extension/src/services/api-client.js";
import { createAuthServiceClient, AuthError } from "../apps/extension/src/services/auth-client.js";
import { createInMemoryTokenStorage } from "../apps/extension/src/services/token-storage.js";

// This test exercises the extension's real src/services/auth-client.ts and
// src/services/api-client.ts (the same modules the popup UI calls) against
// the real Hono/Better Auth backend, over real HTTP — no mocked fetch, no
// Docker/Mailpit needed (mail delivery is a plain injected function, same
// technique as tests/backend.test.ts). This is what proves "auth is
// integrated and complete" beyond a typecheck.

const c = config({
  BETTER_AUTH_SECRET: "a".repeat(40),
  INVITE_SECRET: "b".repeat(40),
  LIVEKIT_API_KEY: "test",
  LIVEKIT_API_SECRET: "c".repeat(40),
  LIVEKIT_URL: "ws://localhost:7880",
  LIVEKIT_INTERNAL_URL: "http://localhost:7880",
});

const cleanup: Array<() => unknown | Promise<unknown>> = [];
afterEach(async () => {
  for (const f of cleanup.splice(0).reverse()) await f();
  vi.restoreAllMocks();
});

async function startServer() {
  vi.spyOn(console, "log").mockImplementation(() => {});
  const dir = await mkdtemp(join(tmpdir(), "syncron-ext-test-"));
  cleanup.push(() =>
    rm(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }),
  );
  const { db, client } = await openDatabase(pathToFileURL(join(dir, "test.db")).href);
  cleanup.push(() => client.close());

  const mails: Mail[] = [];
  const auth = createAuth(db, c, async (m) => {
    mails.push(m);
  });
  const media: MediaService = {
    token: async () => {
      throw new Error("not exercised in this test");
    },
    remove: async () => {},
    microphone: async () => {},
    end: async () => {},
    health: async () => {},
  };
  const runtime = await createApp({ db, auth, config: c, media });
  cleanup.push(runtime.stop);

  const port = await new Promise<number>((resolve) => {
    const server = serve(
      { fetch: runtime.app.fetch, port: 0, hostname: "127.0.0.1" },
      (info) => resolve((info as { port: number }).port),
    );
    cleanup.push(() => new Promise<void>((done) => server.close(() => done())));
  });

  return { baseURL: `http://127.0.0.1:${port}`, mails };
}

test("extension auth client: sign-up, OTP verify, sign-in and onboarding against the real backend", async () => {
  const { baseURL, mails } = await startServer();
  const tokenStorage = createInMemoryTokenStorage();
  const authClient = createAuthServiceClient(baseURL, tokenStorage);
  const apiClient = createApiClient(baseURL, () => tokenStorage.get());

  const email = "alex@example.com";
  const password = "correct-horse-battery-123";
  await authClient.signUp({ email, password, name: "Alex" });
  expect(await tokenStorage.get()).toBeNull();

  const otp = mails.at(-1)?.otp;
  expect(otp).toBeTruthy();
  await authClient.verifyEmailOtp({ email, otp: otp! });

  await authClient.signIn({ email, password });
  expect(await tokenStorage.get()).toBeTruthy();

  const beforeOnboarding = await apiClient.me();
  expect(beforeOnboarding.email).toBe(email);
  expect(beforeOnboarding.onboardingCompletedAt).toBeNull();

  const afterOnboarding = await apiClient.completeOnboarding({ username: "alex", avatarId: "7" });
  expect(afterOnboarding.username).toBe("alex");
  expect(afterOnboarding.avatarId).toBe("7");
  expect(afterOnboarding.onboardingCompletedAt).not.toBeNull();

  await authClient.signOut();
  expect(await tokenStorage.get()).toBeNull();
});

test("extension auth client: signing in before verifying surfaces EMAIL_NOT_VERIFIED", async () => {
  const { baseURL } = await startServer();
  const tokenStorage = createInMemoryTokenStorage();
  const authClient = createAuthServiceClient(baseURL, tokenStorage);

  const email = "riley@example.com";
  const password = "correct-horse-battery-123";
  await authClient.signUp({ email, password, name: "Riley" });

  await expect(authClient.signIn({ email, password })).rejects.toEqual(
    expect.objectContaining({ code: "EMAIL_NOT_VERIFIED" }),
  );
  expect(await tokenStorage.get()).toBeNull();
});

test("extension auth client: wrong password surfaces a generic invalid-credentials error", async () => {
  const { baseURL, mails } = await startServer();
  const tokenStorage = createInMemoryTokenStorage();
  const authClient = createAuthServiceClient(baseURL, tokenStorage);

  const email = "sam@example.com";
  await authClient.signUp({ email, password: "correct-horse-battery-123", name: "Sam" });
  await authClient.verifyEmailOtp({ email, otp: mails.at(-1)!.otp });

  const error: unknown = await authClient
    .signIn({ email, password: "wrong-password" })
    .catch((e) => e);
  expect(error).toBeInstanceOf(AuthError);
  expect((error as AuthError).code).not.toBe("EMAIL_NOT_VERIFIED");
});
