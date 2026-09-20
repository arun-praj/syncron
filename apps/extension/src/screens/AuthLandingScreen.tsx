import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Logo } from "@/components/Logo";

export default function AuthLandingScreen({
  message,
  onSignIn,
  onSignUp,
}: {
  message: string | null;
  onSignIn: () => void;
  onSignUp: () => void;
}) {
  return (
    <div className="flex flex-col items-center px-[22px] pb-[18px] pt-[26px]">
      <div className="mb-5">
        <Logo />
      </div>
      <h1 className="mb-[5px] text-h1 font-bold text-ink-primary">Watch together</h1>
      <p className="mb-5 text-center text-subtext text-ink-secondary">
        Sync playback, chat, and calls with your friends in Syncron.
      </p>

      <Card>
        {message && <p className="mb-3 text-center text-[11px] text-accent">{message}</p>}
        <div className="flex flex-col gap-2">
          <Button type="button" onClick={onSignIn}>
            Sign in
          </Button>
          <Button type="button" variant="secondary" onClick={onSignUp}>
            Sign up
          </Button>
        </div>
      </Card>
    </div>
  );
}
