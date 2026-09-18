import { describe, expect, it } from "vitest";
import {
  authErrorMessage,
  needsEmailVerification,
  validatePasswordChange,
} from "../apps/extension/src/auth-flow.js";

describe("extension auth flow", () => {
  it("only routes the explicit unverified error to verification", () => {
    expect(needsEmailVerification("EMAIL_NOT_VERIFIED")).toBe(true);
    expect(needsEmailVerification("INVALID_EMAIL_OR_PASSWORD")).toBe(false);
  });

  it("validates password confirmation and Better Auth length limits", () => {
    expect(
      validatePasswordChange({
        currentPassword: "",
        newPassword: "short",
        confirmPassword: "short",
      }),
    ).toEqual({
      currentPassword: "Enter your current password.",
      newPassword: "Use at least 8 characters.",
    });
    expect(
      validatePasswordChange({
        currentPassword: "current",
        newPassword: "long-enough",
        confirmPassword: "different",
      }),
    ).toEqual({ confirmPassword: "Passwords don't match." });
    expect(
      validatePasswordChange({
        currentPassword: "current",
        newPassword: "long-enough",
        confirmPassword: "long-enough",
      }),
    ).toEqual({});
    expect(
      validatePasswordChange({
        currentPassword: "current",
        newPassword: "a".repeat(129),
        confirmPassword: "a".repeat(129),
      }),
    ).toEqual({ newPassword: "Use 128 characters or fewer." });
  });

  it("maps Better Auth password-change errors to useful messages", () => {
    expect(authErrorMessage({ code: "INVALID_PASSWORD" })).toBe(
      "Your current password is incorrect.",
    );
    expect(authErrorMessage({ code: "PASSWORD_TOO_SHORT" })).toContain(
      "at least 8 characters",
    );
    expect(authErrorMessage({ code: "PASSWORD_TOO_LONG" })).toContain(
      "128 characters or fewer",
    );
    expect(authErrorMessage({ code: "CREDENTIAL_ACCOUNT_NOT_FOUND" })).toContain(
      "email/password accounts",
    );
  });
});
