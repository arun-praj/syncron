import { useState } from "react"

import { Button } from "~common/components/Button"
import { Card } from "~common/components/Card"
import { Divider } from "~common/components/Divider"
import { GoogleIcon } from "~common/components/icons"
import { Input } from "~common/components/Input"
import { Logo } from "~common/components/Logo"
import { useAuth } from "~common/state/AuthContext"

export default function LoginScreen({
  onSwitchToSignup
}: {
  onSwitchToSignup: () => void
}) {
  const { login } = useAuth()
  const [showPw, setShowPw] = useState(false)

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
        <Button variant="secondary" icon={<GoogleIcon />}>
          Continue with Google
        </Button>

        <Divider label="or email" />

        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            login()
          }}>
          <Input
            id="email"
            type="email"
            label="Email address"
            placeholder="you@example.com"
            required
          />
          <div>
            <div className="mb-[5px] flex items-center justify-between">
              <label htmlFor="password" className="text-label font-medium text-ink-label">
                Password
              </label>
              <a
                href="#"
                className="text-[11px] text-ink-secondary hover:text-ink-primary hover:underline">
                Forgot?
              </a>
            </div>
            <Input
              id="password"
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
          <Button type="submit" className="mt-0.5">
            Sign in
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
  )
}
