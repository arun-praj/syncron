import { useState } from "react";

import { Button } from "@/src/components/Button";
import { Card } from "@/src/components/Card";
import { Divider } from "@/src/components/Divider";
import { GoogleIcon } from "@/src/components/icons";
import { Input } from "@/src/components/Input";
import { Logo } from "@/src/components/Logo";
import { useAuthStore } from "@/src/stores/auth-store";

type Step = "sign-in" | "request-reset" | "reset";

export default function LoginScreen({ onSwitchToSignup }: { onSwitchToSignup: () => void }) {
  const { signIn, requestPasswordReset, resetPassword, submitting, error, clearError } =
    useAuthStore();
  const [showPw, setShowPw] = useState(false);
  const [step, setStep] = useState<Step>("sign-in");
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);

  if (step !== "sign-in") {
    return (
      <div className="flex flex-col items-center px-[22px] pb-[18px] pt-[26px]">
        <div className="mb-5">
          <Logo />
        </div>
        <h1 className="mb-[5px] whitespace-nowrap text-h1 font-bold text-ink-primary">
          Reset your password
        </h1>
        <p className="mb-5 text-center text-subtext text-ink-secondary">
          {step === "request-reset"
            ? "We'll send a 6-digit code to your email."
            : `Enter the code sent to ${resetEmail} and a new password.`}
        </p>

        <Card>
          {step === "request-reset" ? (
            <form
              className="flex flex-col gap-3"
              onSubmit={async (e) => {
                e.preventDefault();
                clearError();
                await requestPasswordReset(resetEmail);
                setResetSent(true);
                setStep("reset");
              }}>
              <Input
                type="email"
                label="Email address"
                placeholder="you@example.com"
                required
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
              />
              {error && <p className="text-[11px] text-red-500">{error}</p>}
              <Button type="submit" disabled={submitting}>
                {submitting ? "Sending…" : "Send reset code"}
              </Button>
            </form>
          ) : (
            <ResetPasswordForm
              email={resetEmail}
              resent={resetSent}
              submitting={submitting}
              error={error}
              onResend={async () => {
                clearError();
                await requestPasswordReset(resetEmail);
              }}
              onSubmit={async (otp, password) => {
                clearError();
                await resetPassword({ email: resetEmail, otp, password });
                setStep("sign-in");
              }}
            />
          )}
        </Card>

        <button
          type="button"
          onClick={() => {
            clearError();
            setStep("sign-in");
          }}
          className="mt-[18px] text-footer text-ink-secondary hover:text-ink-primary hover:underline">
          ← Back to sign in
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center px-[22px] pb-[18px] pt-[26px]">
      <div className="mb-5">
        <Logo />
      </div>

      <h1 className="mb-[5px] whitespace-nowrap text-h1 font-bold text-ink-primary">
        Welcome back
      </h1>
      <p className="mb-5 text-center text-subtext text-ink-secondary">
        Sign in to jump back into your watch party.
      </p>

      <Card>
        <Button variant="secondary" icon={<GoogleIcon />} disabled title="Coming soon">
          Continue with Google
        </Button>

        <Divider label="or email" />

        <form
          className="flex flex-col gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            clearError();
            const form = new FormData(e.currentTarget);
            await signIn({
              email: String(form.get("email")),
              password: String(form.get("password")),
            });
          }}>
          <Input id="email" name="email" type="email" label="Email address" placeholder="you@example.com" required />
          <div>
            <div className="mb-[5px] flex items-center justify-between">
              <label htmlFor="password" className="text-label font-medium text-ink-label">
                Password
              </label>
              <button
                type="button"
                onClick={() => {
                  clearError();
                  setStep("request-reset");
                }}
                className="text-[11px] text-ink-secondary hover:text-ink-primary hover:underline">
                Forgot?
              </button>
            </div>
            <Input
              id="password"
              name="password"
              type={showPw ? "text" : "password"}
              placeholder="••••••••"
              required
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="px-1 text-[11px] text-ink-placeholder hover:text-neutral-600">
                  {showPw ? "Hide" : "Show"}
                </button>
              }
            />
          </div>
          {error && <p className="text-[11px] text-red-500">{error}</p>}
          <Button type="submit" className="mt-0.5" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </Card>

      <p className="mt-[18px] text-footer text-ink-secondary">
        Don&apos;t have an account?{" "}
        <button
          type="button"
          onClick={onSwitchToSignup}
          className="font-semibold text-accent hover:underline">
          Sign up
        </button>
      </p>
    </div>
  );
}

function ResetPasswordForm({
  email,
  resent,
  submitting,
  error,
  onResend,
  onSubmit,
}: {
  email: string;
  resent: boolean;
  submitting: boolean;
  error: string | null;
  onResend: () => void;
  onSubmit: (otp: string, password: string) => void;
}) {
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(otp, password);
      }}>
      <Input
        label="6-digit code"
        inputMode="numeric"
        maxLength={6}
        placeholder="123456"
        required
        value={otp}
        onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ""))}
      />
      <Input
        type="password"
        label="New password"
        placeholder="••••••••"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && <p className="text-[11px] text-red-500">{error}</p>}
      <Button type="submit" disabled={submitting}>
        {submitting ? "Resetting…" : "Reset password"}
      </Button>
      <p className="text-center text-footer text-ink-secondary">
        {resent ? `Code sent to ${email}. ` : null}
        <button
          type="button"
          onClick={onResend}
          className="font-semibold text-accent hover:underline">
          Resend code
        </button>
      </p>
    </form>
  );
}
