import { create } from "zustand";
import type { z } from "zod";
import type {
  onboarding as onboardingRequestSchema,
  profileUpdate as profileUpdateSchema,
} from "@syncron/protocol";

import { authErrorMessage, needsEmailVerification } from "~/auth-flow";
import {
  authClient,
  clearStoredSession,
  getStoredToken,
} from "~/services/auth/client";
import { api, ApiError } from "~/services/api/client";

export type AuthStatus =
  | "loading"
  | "signed-out"
  | "needs-verification"
  | "needs-onboarding"
  | "unavailable"
  | "ready";

export interface SyncronUser {
  id: string;
  username: string;
  avatarId: string | null;
  displayName: string;
  image: string | null;
  email: string;
  emailVerified: boolean;
  createdAt: string;
  onboardingCompletedAt: string | null;
}

interface AuthState {
  status: AuthStatus;
  user: SyncronUser | null;
  pendingEmail: string | null;
  error: string | null;
  info: string | null;
  isSubmitting: boolean;

  hydrate: () => Promise<void>;
  signUp: (input: { name: string; email: string; password: string }) => Promise<void>;
  signIn: (input: { email: string; password: string }) => Promise<void>;
  verifyOtp: (otp: string) => Promise<void>;
  resendOtp: () => Promise<void>;
  completeOnboarding: (
    input: z.infer<typeof onboardingRequestSchema>,
  ) => Promise<void>;
  updateProfile: (input: z.infer<typeof profileUpdateSchema>) => Promise<void>;
  signOut: () => Promise<void>;
  changePassword: (input: { currentPassword: string; newPassword: string }) => Promise<boolean>;
  requestPasswordReset: (email: string) => Promise<void>;
  resetPassword: (input: { email: string; otp: string; password: string }) => Promise<void>;
  clearError: () => void;
  backToSignIn: () => void;
}

// A password never touches extension storage, ever — it's held in a
// closure variable (not even component/store state) only for the brief
// window between OTP verification and the sign-in call that follows it,
// mirroring the exact sequence validated in scripts/docker-smoke.ts.
// Better Auth's verify-email response can include its own session token,
// but relying on the explicitly proven sign-up -> verify -> sign-in chain
// is the safer bet here since that's the one actually exercised against a
// live backend.
let pendingPassword: string | null = null;
let authRevision = 0;

function statusFor(user: SyncronUser): AuthStatus {
  return user.onboardingCompletedAt ? "ready" : "needs-onboarding";
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: "loading",
  user: null,
  pendingEmail: null,
  error: null,
  info: null,
  isSubmitting: false,

  clearError: () => set({ error: null, info: null }),

  backToSignIn: () => {
    pendingPassword = null;
    set({ status: "signed-out", pendingEmail: null, error: null, info: null });
  },

  hydrate: async () => {
    if (get().isSubmitting) return;
    const revision = authRevision;
    const token = await getStoredToken();
    if (!token) {
      if (revision === authRevision) set({ status: "signed-out" });
      return;
    }
    try {
      const { user } = await api.me();
      if (revision === authRevision) set({ status: statusFor(user), user, error: null });
    } catch (error) {
      if (revision !== authRevision) return;
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        await clearStoredSession();
        if (revision === authRevision) set({ status: "signed-out", user: null });
        return;
      }
      set({
        status: "unavailable",
        error: "Couldn’t verify your session. Check your connection and try again.",
      });
    }
  },

  signUp: async ({ name, email, password }) => {
    set({ isSubmitting: true, error: null, info: null });
    const { error } = await authClient.signUp.email({ name, email, password });
    set({ isSubmitting: false });
    if (error) {
      set({ error: authErrorMessage(error) });
      return;
    }
    pendingPassword = password;
    set({ status: "needs-verification", pendingEmail: email });
  },

  signIn: async ({ email, password }) => {
    authRevision += 1;
    set({ isSubmitting: true, error: null, info: null });
    const { error } = await authClient.signIn.email({ email, password });
    if (error) {
      if (needsEmailVerification(error.code)) {
        pendingPassword = password;
        await authClient.emailOtp.sendVerificationOtp({
          email,
          type: "email-verification",
        });
        set({
          isSubmitting: false,
          status: "needs-verification",
          pendingEmail: email,
          info: "Your email isn't verified yet. We just sent you a new code.",
        });
        return;
      }
      set({ isSubmitting: false, error: authErrorMessage(error) });
      return;
    }
    try {
      const { user } = await api.me();
      set({ isSubmitting: false, status: statusFor(user), user });
    } catch (e) {
      set({
        isSubmitting: false,
        error: e instanceof ApiError ? authErrorMessage(e) : authErrorMessage(null),
      });
    }
  },

  verifyOtp: async (otp) => {
    const email = get().pendingEmail;
    if (!email) return;
    set({ isSubmitting: true, error: null, info: null });
    const { error } = await authClient.emailOtp.verifyEmail({ email, otp });
    if (error) {
      set({ isSubmitting: false, error: authErrorMessage(error) });
      return;
    }
    const password = pendingPassword;
    pendingPassword = null;
    if (!password) {
      // Reached verification without a password in memory (e.g. popup was
      // closed and reopened mid-flow) — send the user back to sign in
      // normally now that their email is verified.
      set({
        isSubmitting: false,
        status: "signed-out",
        pendingEmail: null,
        info: "Email verified. Return to the extension popup to sign in.",
      });
      return;
    }
    const { error: signInError } = await authClient.signIn.email({ email, password });
    if (signInError) {
      set({ isSubmitting: false, error: authErrorMessage(signInError) });
      return;
    }
    try {
      const { user } = await api.me();
      set({ isSubmitting: false, status: statusFor(user), user, pendingEmail: null });
    } catch (e) {
      set({
        isSubmitting: false,
        error: e instanceof ApiError ? authErrorMessage(e) : authErrorMessage(null),
      });
    }
  },

  resendOtp: async () => {
    const email = get().pendingEmail;
    if (!email) return;
    set({ isSubmitting: true, error: null, info: null });
    const { error } = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: "email-verification",
    });
    set({
      isSubmitting: false,
      error: error ? authErrorMessage(error) : null,
      info: error ? null : "We sent a new code.",
    });
  },

  completeOnboarding: async (input) => {
    set({ isSubmitting: true, error: null, info: null });
    try {
      const { user } = await api.completeOnboarding(input);
      set({ isSubmitting: false, status: statusFor(user), user });
    } catch (e) {
      set({
        isSubmitting: false,
        error: e instanceof ApiError ? authErrorMessage(e) : authErrorMessage(null),
      });
    }
  },

  updateProfile: async (input) => {
    set({ isSubmitting: true, error: null, info: null });
    try {
      const { user } = await api.updateMe(input);
      set({ isSubmitting: false, user });
    } catch (e) {
      set({
        isSubmitting: false,
        error: e instanceof ApiError ? authErrorMessage(e) : authErrorMessage(null),
      });
      throw e;
    }
  },

  signOut: async () => {
    authRevision += 1;
    set({ isSubmitting: true });
    try {
      await authClient.signOut();
    } finally {
      await clearStoredSession();
      pendingPassword = null;
      set({
        isSubmitting: false,
        status: "signed-out",
        user: null,
        pendingEmail: null,
        error: null,
        info: null,
      });
    }
  },

  changePassword: async ({ currentPassword, newPassword }) => {
    set({ isSubmitting: true, error: null, info: null });
    const { error } = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    });
    if (error) {
      set({ isSubmitting: false, error: authErrorMessage(error) });
      return false;
    }
    set({ isSubmitting: false, info: "Your password has been changed." });
    return true;
  },

  // docs/backend-development.md's documented recovery flow: request an
  // email-OTP-based reset, then submit the code + new password. Password
  // reset revokes existing sessions server-side, so send the user back to
  // sign in with their new password rather than trying to re-hydrate.
  requestPasswordReset: async (email) => {
    set({ isSubmitting: true, error: null, info: null });
    const { error } = await authClient.emailOtp.requestPasswordReset({ email });
    set({
      isSubmitting: false,
      error: error ? authErrorMessage(error) : null,
      info: error ? null : "We sent a password reset code.",
    });
  },

  resetPassword: async ({ email, otp, password }) => {
    set({ isSubmitting: true, error: null, info: null });
    const { error } = await authClient.emailOtp.resetPassword({ email, otp, password });
    set({ isSubmitting: false });
    if (error) {
      set({ error: authErrorMessage(error) });
      return;
    }
    set({ status: "signed-out", info: "Password updated. Sign in with your new password." });
  },
}));
