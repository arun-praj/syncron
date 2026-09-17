import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";

import type { TokenStorage } from "./token-storage.js";

export class AuthError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export interface AuthClient {
  signUp(params: { email: string; password: string; name: string }): Promise<void>;
  verifyEmailOtp(params: { email: string; otp: string }): Promise<void>;
  sendVerificationOtp(email: string): Promise<void>;
  signIn(params: { email: string; password: string }): Promise<{ token: string }>;
  signOut(): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  resetPassword(params: { email: string; otp: string; password: string }): Promise<void>;
}

interface FetchResult<T> {
  data: T | null;
  error: ({ code?: string; message?: string } & Record<string, unknown>) | null;
}

function unwrap<T>({ data, error }: FetchResult<T>): T {
  if (error) throw new AuthError(error.code ?? "UNKNOWN_ERROR", error.message ?? "Request failed");
  return data as T;
}

// Framework-agnostic factory (baseURL + injected TokenStorage) so the real
// Better Auth client is what tests/extension-auth-flow.test.ts exercises
// against the in-process backend — chrome.storage.local only enters the
// picture through browser-token-storage.ts, wired at the entrypoint layer.
export function createAuthServiceClient(baseURL: string, tokenStorage: TokenStorage): AuthClient {
  const client = createAuthClient({
    baseURL,
    plugins: [emailOTPClient()],
    fetchOptions: {
      auth: {
        type: "Bearer",
        token: async () => (await tokenStorage.get()) ?? undefined,
      },
    },
  });

  return {
    async signUp({ email, password, name }) {
      unwrap(await client.signUp.email({ email, password, name }));
    },
    async verifyEmailOtp({ email, otp }) {
      unwrap(await client.emailOtp.verifyEmail({ email, otp }));
    },
    async sendVerificationOtp(email) {
      unwrap(await client.emailOtp.sendVerificationOtp({ email, type: "email-verification" }));
    },
    async signIn({ email, password }) {
      const data = unwrap(await client.signIn.email({ email, password }));
      const token = (data as { token?: string }).token;
      if (!token) throw new AuthError("UNKNOWN_ERROR", "Sign-in did not return a session token");
      await tokenStorage.set(token);
      return { token };
    },
    async signOut() {
      await client.signOut();
      await tokenStorage.clear();
    },
    async requestPasswordReset(email) {
      unwrap(await client.emailOtp.requestPasswordReset({ email }));
    },
    async resetPassword({ email, otp, password }) {
      unwrap(await client.emailOtp.resetPassword({ email, otp, password }));
    },
  };
}
