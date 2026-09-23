import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authClient: {
    signOut: vi.fn(),
    emailOtp: {
      requestPasswordReset: vi.fn(),
      resetPassword: vi.fn(),
    },
  },
  getStoredToken: vi.fn(),
  clearStoredSession: vi.fn(),
  api: { me: vi.fn() },
  room: { identity: null, forceLeave: vi.fn() },
  ApiError: class ApiError extends Error {
    constructor(status) {
      super("session error");
      this.status = status;
    }
  },
}));

vi.mock("~/services/auth/client", () => ({
  authClient: mocks.authClient,
  getStoredToken: mocks.getStoredToken,
  clearStoredSession: mocks.clearStoredSession,
}));
vi.mock("~/services/api/client", () => ({
  api: mocks.api,
  ApiError: mocks.ApiError,
}));
vi.mock("~/stores/room-store", () => ({
  useRoomStore: { getState: () => mocks.room },
}));
vi.mock("~/auth-flow", () => ({
  authErrorMessage: vi.fn(() => "Authentication failed."),
  needsEmailVerification: vi.fn(() => false),
}));

const authStore = await import("../apps/extension/src/stores/auth-store.ts");

const user = (id) => ({
  id,
  username: id,
  avatarId: null,
  displayName: id,
  image: null,
  email: `${id}@example.test`,
  emailVerified: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  onboardingCompletedAt: "2026-01-01T00:00:00.000Z",
});

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

async function flush() {
  for (let index = 0; index < 5; index += 1) await Promise.resolve();
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getStoredToken.mockResolvedValue("token");
  mocks.api.me.mockResolvedValue({ user: user("old") });
  mocks.clearStoredSession.mockResolvedValue(undefined);
  mocks.authClient.emailOtp.requestPasswordReset.mockReset();
  mocks.authClient.emailOtp.resetPassword.mockReset();
  mocks.room.identity = { roomId: "room-1", selfUserId: "old" };
  authStore.useAuthStore.setState({
    status: "ready",
    user: user("old"),
    pendingEmail: null,
    error: null,
    info: null,
    isSubmitting: false,
  });
});

describe("auth session room teardown", () => {
  test("missing token clears an active room even without a cached user", async () => {
    mocks.getStoredToken.mockResolvedValue(null);
    authStore.useAuthStore.setState({ status: "loading", user: null });

    await authStore.useAuthStore.getState().hydrate();

    expect(mocks.room.forceLeave).toHaveBeenCalledWith("Your Syncron session ended.");
    expect(authStore.useAuthStore.getState().status).toBe("signed-out");
    expect(authStore.useAuthStore.getState().user).toBeNull();
  });

  test("a different authenticated user tears down the old room", async () => {
    mocks.api.me.mockResolvedValue({ user: user("new") });

    await authStore.useAuthStore.getState().hydrate();

    expect(mocks.room.forceLeave).toHaveBeenCalledWith("Your account changed. Rejoin the party from the new account.");
    expect(authStore.useAuthStore.getState().user.id).toBe("new");
  });

  test("a recovered room is checked against the new user without cached auth state", async () => {
    mocks.api.me.mockResolvedValue({ user: user("new") });
    authStore.useAuthStore.setState({ status: "loading", user: null });

    await authStore.useAuthStore.getState().hydrate();

    expect(mocks.room.forceLeave).toHaveBeenCalledWith("Your account changed. Rejoin the party from the new account.");
    expect(authStore.useAuthStore.getState().user.id).toBe("new");
  });

  test("a temporary session check failure preserves the room and user", async () => {
    mocks.api.me.mockRejectedValue(new Error("network unavailable"));

    await authStore.useAuthStore.getState().hydrate();

    expect(mocks.room.forceLeave).not.toHaveBeenCalled();
    expect(authStore.useAuthStore.getState().status).toBe("unavailable");
    expect(authStore.useAuthStore.getState().user.id).toBe("old");
  });

  test("a revoked session clears the room and cached user", async () => {
    mocks.api.me.mockRejectedValue(new mocks.ApiError(401));

    await authStore.useAuthStore.getState().hydrate();

    expect(mocks.clearStoredSession).toHaveBeenCalled();
    expect(mocks.room.forceLeave).toHaveBeenCalledWith("Your Syncron session ended.");
    expect(authStore.useAuthStore.getState().status).toBe("signed-out");
    expect(authStore.useAuthStore.getState().user).toBeNull();
  });

  test("an older hydrate cannot restore a user after a newer logout hydrate", async () => {
    const oldResponse = deferred();
    mocks.getStoredToken.mockReturnValueOnce(Promise.resolve("old-token")).mockResolvedValue(null);
    mocks.api.me.mockReturnValueOnce(oldResponse.promise);

    const oldHydrate = authStore.useAuthStore.getState().hydrate();
    await flush();
    await authStore.useAuthStore.getState().hydrate();
    oldResponse.resolve({ user: user("old") });
    await oldHydrate;

    expect(authStore.useAuthStore.getState().status).toBe("signed-out");
    expect(authStore.useAuthStore.getState().user).toBeNull();
    expect(mocks.room.forceLeave).toHaveBeenCalledTimes(1);
  });
});

describe("password reset", () => {
  test("keeps the request step on a failed code delivery", async () => {
    mocks.authClient.emailOtp.requestPasswordReset.mockResolvedValue({
      error: { code: "TOO_MANY_REQUESTS", status: 429 },
    });

    const result = await authStore.useAuthStore.getState().requestPasswordReset("user@example.test");

    expect(result).toBe(false);
    expect(authStore.useAuthStore.getState().isSubmitting).toBe(false);
    expect(authStore.useAuthStore.getState().error).toBe("Authentication failed.");
    expect(authStore.useAuthStore.getState().info).toBeNull();
  });

  test("reports successful code delivery", async () => {
    mocks.authClient.emailOtp.requestPasswordReset.mockResolvedValue({ error: null });

    const result = await authStore.useAuthStore.getState().requestPasswordReset("user@example.test");

    expect(result).toBe(true);
    expect(authStore.useAuthStore.getState().error).toBeNull();
    expect(authStore.useAuthStore.getState().info).toBe("We sent a password reset code.");
  });

  test("keeps the request step on a network failure", async () => {
    mocks.authClient.emailOtp.requestPasswordReset.mockRejectedValue(new Error("offline"));

    const result = await authStore.useAuthStore.getState().requestPasswordReset("user@example.test");

    expect(result).toBe(false);
    expect(authStore.useAuthStore.getState().isSubmitting).toBe(false);
    expect(authStore.useAuthStore.getState().error).toBe("Authentication failed.");
  });

  test("keeps the reset step on an invalid OTP", async () => {
    mocks.authClient.emailOtp.resetPassword.mockResolvedValue({
      error: { code: "INVALID_OTP" },
    });

    const result = await authStore.useAuthStore.getState().resetPassword({
      email: "user@example.test",
      otp: "000000",
      password: "new-password",
    });

    expect(result).toBe(false);
    expect(authStore.useAuthStore.getState().status).toBe("ready");
    expect(authStore.useAuthStore.getState().isSubmitting).toBe(false);
    expect(authStore.useAuthStore.getState().error).toBe("Authentication failed.");
  });

  test("reports a successful password reset", async () => {
    mocks.authClient.emailOtp.resetPassword.mockResolvedValue({ error: null });

    const result = await authStore.useAuthStore.getState().resetPassword({
      email: "user@example.test",
      otp: "123456",
      password: "new-password",
    });

    expect(result).toBe(true);
    expect(authStore.useAuthStore.getState().status).toBe("signed-out");
    expect(authStore.useAuthStore.getState().info).toBe("Password updated. Sign in with your new password.");
  });
});
