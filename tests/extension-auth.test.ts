import { describe, expect, it } from "vitest";
import { needsEmailVerification } from "../apps/extension/src/auth-flow.js";

describe("extension auth flow", () => {
  it("only routes the explicit unverified error to verification", () => {
    expect(needsEmailVerification("EMAIL_NOT_VERIFIED")).toBe(true);
    expect(needsEmailVerification("INVALID_EMAIL_OR_PASSWORD")).toBe(false);
  });
});
