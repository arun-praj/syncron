import { AvatarGlyph } from "@/src/components/AvatarGlyph";
import { Card } from "@/src/components/Card";
import { Logo } from "@/src/components/Logo";
import { useAuthStore } from "@/src/stores/auth-store";

export default function ProfileScreen({ onBack }: { onBack: () => void }) {
  const { user, signOut } = useAuthStore();
  const displayName = user?.displayName || `@${user?.username ?? ""}`;

  return (
    <div className="flex flex-col px-[18px] pb-5 pt-4">
      <div className="mb-5 flex items-center justify-between">
        <button
          type="button"
          aria-label="Back to home"
          onClick={onBack}
          className="rounded-full px-2 py-1 text-footer text-ink-secondary transition-colors hover:bg-neutral-50 hover:text-ink-primary">
          ←
        </button>
        <Logo />
        <span className="w-7" aria-hidden="true" />
      </div>

      <div className="flex flex-col items-center">
        {user?.avatarId && <AvatarGlyph avatarId={user.avatarId} className="h-20 w-20" />}
        <h1 className="mt-3 text-h1 font-bold text-ink-primary">{displayName}</h1>
        <p className="mt-1 text-subtext text-ink-secondary">@{user?.username ?? ""}</p>
      </div>

      <Card className="mt-5">
        <div className="flex items-center justify-between gap-4 border-b border-border pb-3">
          <span className="text-label font-medium text-ink-label">Email</span>
          <span className="truncate text-right text-label text-ink-secondary">{user?.email}</span>
        </div>
        <div className="flex items-center justify-between gap-4 pt-3">
          <span className="text-label font-medium text-ink-label">Email status</span>
          <span className="text-label font-medium text-green-600">Verified</span>
        </div>
      </Card>

      <button
        type="button"
        onClick={onBack}
        className="mt-5 text-center text-footer text-ink-secondary transition-colors hover:text-ink-primary hover:underline">
        ← Back to home
      </button>

      <button
        type="button"
        onClick={() => void signOut()}
        className="mt-4 border-t border-border pt-4 text-center text-footer text-ink-secondary transition-colors hover:text-red-600 hover:underline">
        Sign out
      </button>
    </div>
  );
}
