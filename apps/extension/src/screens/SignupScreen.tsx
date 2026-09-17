import { useState } from "react";

import { Button } from "@/src/components/Button";
import { Card } from "@/src/components/Card";
import { Divider } from "@/src/components/Divider";
import { GoogleIcon } from "@/src/components/icons";
import { Input } from "@/src/components/Input";
import { Logo } from "@/src/components/Logo";
import { useAuthStore } from "@/src/stores/auth-store";

export default function SignupScreen({ onSwitchToLogin }: { onSwitchToLogin: () => void }) {
  const { signUp, submitting, error, clearError } = useAuthStore();
  const [showPw, setShowPw] = useState(false);

  return (
    <div className="flex flex-col items-center px-[22px] pb-[18px] pt-[26px]">
      <div className="mb-5">
        <Logo />
      </div>

      <h1 className="mb-[5px] whitespace-nowrap text-h1 font-bold text-ink-primary">
        Create your account
      </h1>
      <p className="mb-5 text-center text-subtext text-ink-secondary">
        Start a watch party in a few seconds.
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
            await signUp({
              name: String(form.get("name")),
              email: String(form.get("email")),
              password: String(form.get("password")),
            });
          }}>
          <Input id="name" name="name" type="text" label="Full name" placeholder="Jane Doe" required />
          <Input
            id="signup-email"
            name="email"
            type="email"
            label="Email address"
            placeholder="you@example.com"
            required
          />
          <Input
            id="signup-password"
            name="password"
            type={showPw ? "text" : "password"}
            label="Password"
            placeholder="••••••••"
            required
            minLength={8}
            trailing={
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                className="px-1 text-[11px] text-ink-placeholder hover:text-neutral-600">
                {showPw ? "Hide" : "Show"}
              </button>
            }
          />
          {error && <p className="text-[11px] text-red-500">{error}</p>}
          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating account…" : "Create account"}
          </Button>
        </form>
      </Card>

      <p className="mt-[18px] text-footer text-ink-secondary">
        Already have an account?{" "}
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="font-semibold text-accent hover:underline">
          Sign in
        </button>
      </p>
    </div>
  );
}
