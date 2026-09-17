import { useMemo, useState } from "react";

import { username as usernameSchema } from "@syncron/validation";

import { AVATAR_IDS, AvatarGlyph } from "@/components/AvatarGlyph";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Logo } from "@/components/Logo";
import { useAuthStore } from "@/stores/auth-store";

const DEFAULT_MESSAGE = "3–32 characters: letters, numbers, underscores, periods.";

function validateUsername(raw: string): string | null {
  const value = raw.trim().toLowerCase();
  if (!value) return "Username is required.";
  const result = usernameSchema.safeParse(value);
  if (result.success) return null;
  if (value.length < 3) return "Must be at least 3 characters.";
  if (value.length > 32) return "Must be 32 characters or fewer.";
  return "Letters, numbers, underscores, periods — can't start/end with a period, and some names are reserved.";
}

export default function OnboardingScreen() {
  const { completeOnboarding, isSubmitting, error } = useAuthStore();
  const [selectedAvatar, setSelectedAvatar] = useState(
    () => AVATAR_IDS[Math.floor(Math.random() * AVATAR_IDS.length)]!,
  );
  const [username, setUsername] = useState("");
  const [touched, setTouched] = useState(false);

  const validationError = useMemo(() => validateUsername(username), [username]);
  const showError = touched && validationError;

  return (
    <div className="flex flex-col items-center px-[22px] pb-4 pt-4.5">
      <div className="mb-2.5">
        <Logo />
      </div>

      <h1 className="mb-1 whitespace-nowrap text-h1 font-bold text-ink-primary">
        Set up your profile
      </h1>
      <p className="mb-3.5 text-center text-subtext text-ink-secondary">
        Pick an avatar and a username so friends can find you.
      </p>

      <Card className="p-4">
        <div className="mb-2.5 flex justify-center">
          <AvatarGlyph
            avatarId={selectedAvatar}
            className="h-14 w-14 border border-border"
          />
        </div>

        <label className="mb-1.5 block text-center text-[11.5px] font-medium text-ink-label">
          Choose your memoji
        </label>
        <div className="mb-3 grid max-h-33 grid-cols-5 gap-1.5 overflow-y-auto pr-0.5">
          {AVATAR_IDS.map((id) => (
            <button
              key={id}
              type="button"
              aria-label={`Avatar ${id}`}
              onClick={() => setSelectedAvatar(id)}
              className={`aspect-square w-full max-w-[38px] rounded-full border-2 bg-neutral-100 transition-[border-color,box-shadow,transform] duration-150 ease-standard active:scale-[0.96] ${
                id === selectedAvatar
                  ? "border-accent shadow-[0_0_0_2px_#eff6ff]"
                  : "border-transparent"
              }`}>
              <AvatarGlyph avatarId={id} className="h-full w-full" />
            </button>
          ))}
        </div>

        <label htmlFor="username" className="mb-1 block text-[11.5px] font-medium text-ink-label">
          Username
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-input text-ink-placeholder">
            @
          </span>
          <input
            id="username"
            type="text"
            maxLength={32}
            autoComplete="off"
            placeholder="jamie_rivera"
            value={username}
            onChange={(e) => {
              setTouched(true);
              setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ""));
            }}
            className={`w-full rounded-input border bg-white py-[9px] pl-6 pr-3 text-input text-ink-primary outline-none transition-colors focus:border-ink-primary focus:shadow-focus ${
              showError ? "border-red-300" : "border-border-input"
            }`}
          />
        </div>
        <p
          className={`mt-1 text-[11px] tracking-[-0.005em] ${
            showError ? "text-red-600" : "text-ink-placeholder"
          }`}>
          {showError ? validationError : DEFAULT_MESSAGE}
        </p>

        {error && <p className="mt-2 text-[11px] text-red-500">{error}</p>}

        <Button
          type="button"
          className="mt-2.5"
          disabled={isSubmitting || !!validateUsername(username)}
          onClick={() =>
            void completeOnboarding({ username: username.trim().toLowerCase(), avatarId: selectedAvatar })
          }>
          {isSubmitting ? "Saving…" : "Continue"}
        </Button>
      </Card>
    </div>
  );
}
