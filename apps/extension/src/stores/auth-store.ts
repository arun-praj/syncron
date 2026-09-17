import { create } from "zustand";

import { needsEmailVerification } from "@/src/auth-flow";
import { API_BASE_URL } from "@/src/lib/env";
import { createApiClient, type ApiClient } from "@/src/services/api-client";
import { AuthError, createAuthServiceClient } from "@/src/services/auth-client";
import {
  clearPendingVerification,
  createLocalTokenStorage,
  getPendingVerification,
  setPendingVerification,
} from "@/src/services/browser-token-storage";

type MeUser = Awaited<ReturnType<ApiClient["me"]>>;

export type AuthStatus =
  | "loading"
  | "signed-out"
  | "awaiting-verification"
  | "verification-complete"
  | "signed-in";

interface AuthState {
  status: AuthStatus;
  user: MeUser | null;
  pendingEmail: string | null;
  emailHint: string | null;
  error: string | null;
  submitting: boolean;
  bootstrap: () => Promise<void>;
  signUp: (params: { email: string; password: string; name: string }) => Promise<void>;
  signIn: (params: { email: string; password: string }) => Promise<void>;
  verifyOtp: (otp: string) => Promise<void>;
  resendOtp: () => Promise<void>;
  signOut: () => Promise<void>;
  completeOnboarding: (params: {
    username: string;
    avatarId: string;
    displayName?: string;
  }) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  resetPassword: (params: { email: string; otp: string; password: string }) => Promise<void>;
  cancelVerification: () => Promise<void>;
  clearError: () => void;
}

const tokenStorage = createLocalTokenStorage();
const authClient = createAuthServiceClient(API_BASE_URL, tokenStorage);
const apiClient = createApiClient(API_BASE_URL, () => tokenStorage.get());

const VERIFICATION_TTL_MS = 5 * 60 * 1000;

function describeError(error: unknown): string {
  if (error instanceof AuthError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: "loading",
  user: null,
  pendingEmail: null,
  emailHint: null,
  error: null,
  submitting: false,

  async bootstrap() {
    const token = await tokenStorage.get();
    if (!token) {
      const pending = await getPendingVerification();
      if (pending && pending.expiresAt > Date.now()) {
        set({ status: "awaiting-verification", pendingEmail: pending.email });
      } else {
        if (pending) await clearPendingVerification();
        set({ status: "signed-out" });
      }
      return;
    }
    try {
      const user = await apiClient.me();
      set({ status: "signed-in", user, emailHint: null });
    } catch {
      await tokenStorage.clear();
      set({ status: "signed-out" });
    }
  },

  async signUp({ email, password, name }) {
    set({ submitting: true, error: null });
    try {
      await authClient.signUp({ email, password, name });
      await setPendingVerification({ email, expiresAt: Date.now() + VERIFICATION_TTL_MS });
      set({ status: "awaiting-verification", pendingEmail: email });
    } catch (error) {
      set({ error: describeError(error) });
    } finally {
      set({ submitting: false });
    }
  },

  async signIn({ email, password }) {
    set({ submitting: true, error: null });
    try {
      await authClient.signIn({ email, password });
      const user = await apiClient.me();
      await clearPendingVerification();
      set({ status: "signed-in", user, emailHint: null });
    } catch (error) {
      if (error instanceof AuthError && needsEmailVerification(error.code)) {
        try {
          const pending = await getPendingVerification();
          if (!pending || pending.email !== email || pending.expiresAt <= Date.now()) {
            await authClient.sendVerificationOtp(email);
          }
          await setPendingVerification({ email, expiresAt: Date.now() + VERIFICATION_TTL_MS });
          set({ status: "awaiting-verification", pendingEmail: email });
        } catch (resendError) {
          set({ error: describeError(resendError) });
        }
      } else {
        set({ error: describeError(error) });
      }
    } finally {
      set({ submitting: false });
    }
  },

  async verifyOtp(otp) {
    const email = get().pendingEmail;
    if (!email) return;
    set({ submitting: true, error: null });
    try {
      await authClient.verifyEmailOtp({ email, otp });
      await clearPendingVerification();
      set({
        status: "verification-complete",
        user: null,
        pendingEmail: null,
        emailHint: email,
      });
    } catch (error) {
      set({ error: describeError(error) });
    } finally {
      set({ submitting: false });
    }
  },

  async resendOtp() {
    const email = get().pendingEmail;
    if (!email) return;
    set({ error: null });
    try {
      await authClient.sendVerificationOtp(email);
      await setPendingVerification({ email, expiresAt: Date.now() + VERIFICATION_TTL_MS });
    } catch (error) {
      set({ error: describeError(error) });
    }
  },

  async signOut() {
    await authClient.signOut();
    await clearPendingVerification();
    set({ status: "signed-out", user: null, pendingEmail: null, emailHint: null, error: null });
  },

  async completeOnboarding(params) {
    set({ submitting: true, error: null });
    try {
      const user = await apiClient.completeOnboarding(params);
      set({ user });
    } catch (error) {
      set({ error: describeError(error) });
    } finally {
      set({ submitting: false });
    }
  },

  async requestPasswordReset(email) {
    set({ submitting: true, error: null });
    try {
      await authClient.requestPasswordReset(email);
    } catch (error) {
      set({ error: describeError(error) });
    } finally {
      set({ submitting: false });
    }
  },

  async resetPassword(params) {
    set({ submitting: true, error: null });
    try {
      await authClient.resetPassword(params);
      set({ status: "signed-out", emailHint: params.email });
    } catch (error) {
      set({ error: describeError(error) });
    } finally {
      set({ submitting: false });
    }
  },

  async cancelVerification() {
    await clearPendingVerification();
    set({ status: "signed-out", pendingEmail: null, error: null });
  },

  clearError() {
    set({ error: null });
  },
}));
