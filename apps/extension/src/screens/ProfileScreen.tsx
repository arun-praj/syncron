import { useEffect, useRef, useState } from "react";

import { avatarId as avatarIdSchema } from "@syncron/protocol";
import { username as usernameSchema } from "@syncron/validation";

import { AVATAR_IDS, AvatarGlyph } from "@/components/AvatarGlyph";
import { CheckIcon, ChevronLeftIcon, PencilIcon } from "@/components/icons";
import { useAuthStore } from "@/stores/auth-store";

// Mirrors packages/validation's `username` Zod schema exactly (imported
// directly, not re-implemented — CLAUDE.md: don't duplicate protocol
// types) and just turns its issues into a short, field-level message.
function validateUsername(raw: string): string | null {
  const value = raw.trim().toLowerCase();
  const result = usernameSchema.safeParse(value);
  if (result.success) return null;
  const issue = result.error.issues[0];
  if (issue?.code === "too_small") return "Must be at least 3 characters.";
  if (issue?.code === "too_big") return "Must be 32 characters or fewer.";
  if (issue?.code === "custom") return "That username is taken.";
  return "Letters, numbers, underscores, periods — can't start/end with a period.";
}

// These represent features that don't exist yet (Notifications is
// explicitly deferred per docs/phase-1.md; there's no "connected
// streaming service" concept in the backend, and Change password has no
// dedicated screen yet). Rendered as non-interactive rows with a "Soon"
// tag rather than dead `href="#"` links, so nothing looks clickable when
// it isn't.
const ACCOUNT_ITEMS = [{ label: "Change password" }];
const PREF_ITEMS = [
  { label: "Notifications" },
  { label: "Connected streaming services" },
];

export default function ProfileScreen({ onBack }: { onBack: () => void }) {
  const { user, error, isSubmitting, updateProfile, signOut, clearError } = useAuthStore();

  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState(user?.username ?? "");
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const usernameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingUsername) usernameInputRef.current?.focus();
  }, [editingUsername]);

  const startEditUsername = () => {
    setUsernameDraft(user?.username ?? "");
    setUsernameError(null);
    clearError();
    setEditingUsername(true);
  };

  const saveUsername = async () => {
    const value = usernameDraft.trim().toLowerCase();
    const validationError = validateUsername(value);
    if (validationError) {
      setUsernameError(validationError);
      return;
    }
    if (value === user?.username) {
      setEditingUsername(false);
      return;
    }
    try {
      await updateProfile({ username: value });
      setEditingUsername(false);
    } catch {
      // Store already captured `error` for display below; leave the
      // field open so the user can fix and retry.
    }
  };

  const selectAvatar = async (id: string) => {
    setAvatarPickerOpen(false);
    if (id === user?.avatarId) return;
    const parsed = avatarIdSchema.safeParse(id);
    if (!parsed.success) return;
    await updateProfile({ avatarId: parsed.data }).catch(() => {
      // `error` below already reflects the failure.
    });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-shrink-0 items-center gap-2.5 border-b border-border px-[18px] py-3.5">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to home"
          className="flex h-[26px] w-[26px] items-center justify-center rounded-lg text-ink-label transition-colors hover:bg-neutral-100">
          <ChevronLeftIcon />
        </button>
        <span className="text-logo font-bold text-ink-primary">Profile &amp; settings</span>
      </div>

      <div className="flex flex-col items-center px-5 pb-2 pt-6">
        <div className="relative mb-2.5">
          {user?.avatarId && <AvatarGlyph avatarId={user.avatarId} className="h-16 w-16" />}
          <button
            type="button"
            onClick={() => setAvatarPickerOpen((v) => !v)}
            aria-label="Change avatar"
            className="absolute -bottom-1 -right-1 flex h-[26px] w-[26px] items-center justify-center rounded-full border-[2.5px] border-white bg-accent text-white shadow-sm transition-colors hover:bg-brand-bottom">
            <PencilIcon />
          </button>
        </div>

        {avatarPickerOpen && (
          <div className="mb-3.5 w-full max-h-[120px] overflow-y-auto rounded-card border border-border p-2.5">
            <div className="grid grid-cols-5 gap-1.5">
              {AVATAR_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => void selectAvatar(id)}
                  aria-label={`Avatar ${id}`}
                  className={`box-border aspect-square w-full max-w-[38px] rounded-full border-2 ${
                    id === user?.avatarId ? "border-accent" : "border-transparent"
                  }`}>
                  <AvatarGlyph avatarId={id} className="h-full w-full" />
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex w-full items-center justify-center gap-1.5">
          {editingUsername ? (
            <>
              <input
                ref={usernameInputRef}
                type="text"
                value={usernameDraft}
                onChange={(e) => {
                  setUsernameDraft(e.target.value);
                  setUsernameError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void saveUsername();
                  if (e.key === "Escape") setEditingUsername(false);
                }}
                className="w-40 rounded-lg border border-border-input px-2 py-1 text-center text-[15px] font-semibold text-ink-primary outline-none focus:border-ink-primary focus:shadow-focus"
              />
              <button
                type="button"
                onClick={() => void saveUsername()}
                disabled={isSubmitting}
                aria-label="Save username"
                className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-50 text-accent transition-colors hover:bg-blue-100 disabled:opacity-50">
                <CheckIcon />
              </button>
            </>
          ) : (
            <>
              <div className="text-[15px] font-semibold text-ink-primary">
                @{user?.username}
              </div>
              <button
                type="button"
                onClick={startEditUsername}
                aria-label="Edit username"
                className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-50 text-accent transition-colors hover:bg-blue-100">
                <PencilIcon />
              </button>
            </>
          )}
        </div>
        {usernameError && (
          <p className="mt-1 w-full text-center text-[11px] text-red-600">{usernameError}</p>
        )}
        {error && !usernameError && (
          <p className="mt-1 w-full text-center text-[11px] text-red-600">{error}</p>
        )}
        <div className="mt-1.5 w-full text-center text-label text-ink-placeholder">
          {user?.email}
        </div>
      </div>

      <div className="flex-1 px-[18px] pb-5 pt-[18px]">
        <div className="mb-2 px-0.5 text-[11px] font-medium uppercase tracking-[0.05em] text-ink-placeholder">
          Account
        </div>
        <div className="mb-[18px] flex flex-col gap-1.5">
          {ACCOUNT_ITEMS.map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-3 rounded-[10px] border border-border px-3 py-[11px]">
              <span className="flex-1 text-[13.5px] font-medium text-ink-primary">
                {item.label}
              </span>
              <span className="text-[10.5px] font-medium text-ink-placeholder">Soon</span>
            </div>
          ))}
        </div>

        <div className="mb-2 px-0.5 text-[11px] font-medium uppercase tracking-[0.05em] text-ink-placeholder">
          Preferences
        </div>
        <div className="flex flex-col gap-1.5">
          {PREF_ITEMS.map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-3 rounded-[10px] border border-border px-3 py-[11px]">
              <span className="flex-1 text-[13.5px] font-medium text-ink-primary">
                {item.label}
              </span>
              <span className="text-[10.5px] font-medium text-ink-placeholder">Soon</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-shrink-0 px-[18px] pb-5">
        <button
          type="button"
          onClick={() => void signOut()}
          disabled={isSubmitting}
          className="w-full rounded-input border border-red-200 bg-white px-3.5 py-[10px] text-btn font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50">
          Log out
        </button>
      </div>
    </div>
  );
}
