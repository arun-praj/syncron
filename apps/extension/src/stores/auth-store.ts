import { create } from "zustand";

import { needsEmailVerification } from "@/src/auth-flow";
import { API_BASE_URL } from "@/src/lib/env";
import { createApiClient, type ApiClient } from "@/src/services/api-client";
import { AuthError, createAuthServiceClient } from "@/src/services/auth-client";
import { createLocalTokenStorage } from "@/src/services/browser-token-storage";

type MeUser = Awaited<ReturnType<ApiClient["me"]>>;

export type AuthStatus = "loading" | "signed-out" | "awaiting-verification" | "signed-in";

interface AuthState {
  status: AuthStatus;
  user: MeUser | null;
  pendingEmail: string | null;
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
  cancelVerification: () => void;
  clearError: () => void;
}

const tokenStorage = createLocalTokenStorage();
const authClient = createAuthServiceClient(API_BASE_URL, tokenStorage);
const apiClient = createApiClient(API_BASE_URL, () => tokenStorage.get());

// A signed-in-but-unverified attempt and a fresh signup both land here with
// the password kept only in memory (never persisted) so the OTP screen can
// silently complete sign-in right after a successful verify, instead of
// forcing the user to retype their password.
let pendingPassword: string | null = null;

function describeError(error: unknown): string {
  if (error instanceof AuthError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: "loading",
  user: null,
  pendingEmail: null,
  error: null,
  submitting: false,

  async bootstrap() {
    const token = await tokenStorage.get();
    if (!token) {
      set({ status: "signed-out" });
      return;
    }
    try {
      const user = await apiClient.me();
      set({ status: "signed-in", user });
    } catch {
      await tokenStorage.clear();
      set({ status: "signed-out" });
    }
  },

  async signUp({ email, password, name }) {
    set({ submitting: true, error: null });
    try {
      await authClient.signUp({ email, password, name });
      pendingPassword = password;
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
      set({ status: "signed-in", user });
    } catch (error) {
      if (error instanceof AuthError && needsEmailVerification(error.code)) {
        pendingPassword = password;
        set({ status: "awaiting-verification", pendingEmail: email });
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
      if (pendingPassword) {
        await authClient.signIn({ email, password: pendingPassword });
        pendingPassword = null;
      }
      const user = await apiClient.me();
      set({ status: "signed-in", user, pendingEmail: null });
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
    } catch (error) {
      set({ error: describeError(error) });
    }
  },

  async signOut() {
    await authClient.signOut();
    pendingPassword = null;
    set({ status: "signed-out", user: null, pendingEmail: null, error: null });
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
      set({ status: "signed-out" });
    } catch (error) {
      set({ error: describeError(error) });
    } finally {
      set({ submitting: false });
    }
  },

  cancelVerification() {
    pendingPassword = null;
    set({ status: "signed-out", pendingEmail: null, error: null });
  },

  clearError() {
    set({ error: null });
  },
}));
