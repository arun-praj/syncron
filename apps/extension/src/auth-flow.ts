// Better Auth surfaces failures as a stable error `code` string (see
// @better-auth/core's error/codes.mjs). Only the explicit unverified-email
// code should route a failed sign-in to the OTP verification screen —
// every other failure (bad password, unknown user, rate limiting, ...) is a
// generic sign-in error and must not be treated as "go verify your email".
export function needsEmailVerification(code: string | undefined | null): boolean {
  return code === "EMAIL_NOT_VERIFIED";
}
