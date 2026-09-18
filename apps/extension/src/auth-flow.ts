// Pure, framework-free helpers for interpreting Better Auth's/Syncron's
// error surface. Kept separate from React/UI code so this logic is unit
// testable in isolation — see tests/extension-auth.test.ts.

export function needsEmailVerification(code: string | undefined): boolean {
  return code === "EMAIL_NOT_VERIFIED";
}

export function isInvalidCredentials(code: string | undefined): boolean {
  return code === "INVALID_EMAIL_OR_PASSWORD";
}

export function isAccountAlreadyExists(code: string | undefined): boolean {
  return code === "USER_ALREADY_EXISTS";
}

export function isInvalidOtp(code: string | undefined): boolean {
  return code === "INVALID_OTP";
}

export function isOtpExpired(code: string | undefined): boolean {
  return code === "OTP_EXPIRED";
}

export function isOtpAttemptsExhausted(code: string | undefined): boolean {
  return code === "TOO_MANY_ATTEMPTS";
}

// Better Auth's own rate-limit hook throws APIError("TOO_MANY_REQUESTS", ...)
// without an explicit `code`, so the client-visible code is often absent.
// Our own backend's DomainError("RATE_LIMITED", 429) does set one. Checking
// the HTTP status too makes this robust either way.
export function isRateLimited(
  status: number | undefined,
  code: string | undefined,
): boolean {
  return status === 429 || code === "TOO_MANY_REQUESTS" || code === "RATE_LIMITED";
}

export interface AuthErrorLike {
  code?: string;
  status?: number;
}

export interface PasswordChangeInput {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface PasswordChangeErrors {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
}

export function validatePasswordChange({
  currentPassword,
  newPassword,
  confirmPassword,
}: PasswordChangeInput): PasswordChangeErrors {
  const errors: PasswordChangeErrors = {};
  if (!currentPassword) errors.currentPassword = "Enter your current password.";
  if (!newPassword) errors.newPassword = "Enter a new password.";
  else if (newPassword.length < 8) errors.newPassword = "Use at least 8 characters.";
  else if (newPassword.length > 128)
    errors.newPassword = "Use 128 characters or fewer.";
  if (newPassword && newPassword !== confirmPassword)
    errors.confirmPassword = "Passwords don't match.";
  else if (!confirmPassword) errors.confirmPassword = "Confirm your new password.";
  return errors;
}

// Maps a Better Auth / Syncron API error into a short, user-facing
// message. Falls back to a generic message so the UI never surfaces a raw
// error code to the user.
export function authErrorMessage(error: AuthErrorLike | undefined | null): string {
  if (!error) return "Something went wrong. Please try again.";
  if (isRateLimited(error.status, error.code))
    return "Too many attempts. Please wait a moment and try again.";
  if (needsEmailVerification(error.code))
    return "Please verify your email to continue.";
  if (isInvalidCredentials(error.code)) return "Incorrect email or password.";
  if (error.code === "INVALID_PASSWORD") return "Your current password is incorrect.";
  if (error.code === "PASSWORD_TOO_SHORT")
    return "Your new password is too short. Use at least 8 characters.";
  if (error.code === "PASSWORD_TOO_LONG")
    return "Your new password is too long. Use 128 characters or fewer.";
  if (error.code === "CREDENTIAL_ACCOUNT_NOT_FOUND")
    return "Password changes are only available for email/password accounts.";
  if (isAccountAlreadyExists(error.code))
    return "An account with that email already exists.";
  if (isInvalidOtp(error.code)) return "That code isn't right. Try again.";
  if (isOtpExpired(error.code)) return "That code expired. Request a new one.";
  if (isOtpAttemptsExhausted(error.code))
    return "Too many incorrect attempts. Request a new code.";
  return "Something went wrong. Please try again.";
}
