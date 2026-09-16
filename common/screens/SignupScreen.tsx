import { useState } from "react"

import { Button } from "~common/components/Button"
import { Card } from "~common/components/Card"
import { Divider } from "~common/components/Divider"
import { GoogleIcon } from "~common/components/icons"
import { Input } from "~common/components/Input"
import { Logo } from "~common/components/Logo"
import { useAuth } from "~common/state/AuthContext"

export default function SignupScreen({
  onSwitchToLogin
}: {
  onSwitchToLogin: () => void
}) {
  const { signup } = useAuth()
  const [showPw, setShowPw] = useState(false)

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
        <Button variant="secondary" icon={<GoogleIcon />}>
          Continue with Google
        </Button>

        <Divider label="or email" />

        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            signup()
          }}>
          <Input id="name" type="text" label="Full name" placeholder="Jane Doe" required />
          <Input
            id="signup-email"
            type="email"
            label="Email address"
            placeholder="you@example.com"
            required
          />
          <Input
            id="signup-password"
            type={showPw ? "text" : "password"}
            label="Password"
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
          <Button type="submit">Create account</Button>
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
  )
}
