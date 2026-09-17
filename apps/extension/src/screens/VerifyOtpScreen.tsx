import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Logo } from "@/components/Logo";
import { useAuthStore } from "@/stores/auth-store";

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const visible = local.slice(0, 2);
  const hidden = "*".repeat(Math.max(local.length - visible.length, 3));
  return `${visible}${hidden}@${domain}`;
}

export default function VerifyOtpScreen({ onBack }: { onBack: () => void }) {
  const { pendingEmail, verifyOtp, resendOtp, isSubmitting, error, info, clearError } =
    useAuthStore();
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [shake, setShake] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((s) => s - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  useEffect(() => () => {
    if (shakeTimer.current) clearTimeout(shakeTimer.current);
  }, []);

  function focusFirstEmpty() {
    const emptyIndex = digits.findIndex((d) => !d);
    inputs.current[emptyIndex === -1 ? OTP_LENGTH - 1 : emptyIndex]?.focus();
  }

  function setDigit(index: number, value: string) {
    const clean = value.replace(/[^0-9]/g, "").slice(-1);
    setDigits((prev) => prev.map((d, i) => (i === index ? clean : d)));
    if (clean && index + 1 < OTP_LENGTH) inputs.current[index + 1]?.focus();
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/[^0-9]/g, "").slice(0, OTP_LENGTH);
    if (!pasted) return;
    setDigits((prev) => prev.map((d, i) => pasted[i] ?? d));
    inputs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
  }

  async function submit() {
    const code = digits.join("");
    if (code.length < OTP_LENGTH) {
      if (shakeTimer.current) clearTimeout(shakeTimer.current);
      setShake(true);
      shakeTimer.current = setTimeout(() => {
        setShake(false);
        shakeTimer.current = null;
      }, 400);
      focusFirstEmpty();
      return;
    }
    clearError();
    await verifyOtp(code);
  }

  async function resend() {
    if (cooldown > 0) return;
    clearError();
    await resendOtp();
    setCooldown(RESEND_COOLDOWN_SECONDS);
  }

  return (
    <div className="flex flex-col items-center px-[22px] pb-[18px] pt-[26px]">
      <div className="mb-5">
        <Logo />
      </div>

      <div className="mb-4 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-blue-50">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path
            d="M3 6.5L11.02 12.5C11.5952 12.9256 12.4048 12.9256 12.98 12.5L21 6.5M5 19H19C20.1046 19 21 18.1046 21 17V7C21 5.89543 20.1046 5 19 5H5C3.89543 5 3 5.89543 3 7V17C3 18.1046 3.89543 19 5 19Z"
            stroke="#2563eb"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <h1 className="mb-[5px] whitespace-nowrap text-h1 font-bold text-ink-primary">
        Verify your email
      </h1>
      <p className="mb-1 text-center text-subtext text-ink-secondary">
        We sent a 6-digit code to
        <br />
        <b className="font-semibold text-ink-primary">
          {pendingEmail ? maskEmail(pendingEmail) : ""}
        </b>
      </p>
      <p className="mb-5 text-center text-[11px] text-ink-placeholder">Code expires in 5 minutes</p>
      {info && <p className="mb-3 text-center text-[11px] text-accent">{info}</p>}

      <Card>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}>
          <div
            className={`mb-[18px] flex justify-between gap-2 ${shake ? "animate-[otp-shake_0.4s]" : ""}`}>
            {digits.map((digit, i) => (
              <input
                key={i}
                ref={(el) => {
                  inputs.current[i] = el;
                }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                autoComplete={i === 0 ? "one-time-code" : "off"}
                value={digit}
                onChange={(e) => setDigit(i, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Backspace" && !digit && i > 0) inputs.current[i - 1]?.focus();
                }}
                onPaste={handlePaste}
                className={`h-12 w-[42px] rounded-input border bg-white text-center text-[17px] font-medium text-ink-primary outline-none transition-colors focus:border-ink-primary focus:shadow-focus ${
                  error ? "border-red-400" : "border-border-input"
                }`}
              />
            ))}
          </div>

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Verifying…" : "Verify email"}
          </Button>
          {error && <p className="mt-2.5 text-center text-[11px] text-red-500">{error}</p>}
        </form>

        <p className="mt-2 text-center text-footer text-ink-secondary">
          Didn&apos;t get a code?{" "}
          <button
            type="button"
            onClick={resend}
            disabled={cooldown > 0}
            className={
              cooldown > 0
                ? "font-medium text-ink-placeholder"
                : "font-semibold text-accent hover:underline"
            }>
            {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
          </button>
        </p>
      </Card>

      <button
        type="button"
        onClick={onBack}
        className="mt-[18px] text-footer text-ink-secondary hover:text-ink-primary hover:underline">
        ← Use a different email
      </button>
    </div>
  );
}
