import type { MockUser } from "@/src/lib/mock-data";

export function ParticipantTile({
  user,
  isSpeaking,
  mediaOff,
}: {
  user: MockUser;
  isSpeaking?: boolean;
  mediaOff?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 rounded-2xl border bg-neutral-50 p-3 transition-shadow ${
        isSpeaking ? "border-accent shadow-[0_0_0_3px_rgba(37,99,235,.15)]" : "border-border"
      }`}>
      <div
        className="flex h-12 w-12 items-center justify-center rounded-full text-sm font-semibold text-white"
        style={{ backgroundColor: user.avatarColor }}>
        {user.initials}
      </div>
      <p className="text-[11px] font-medium text-ink-primary">{user.name}</p>
      {mediaOff && <span className="text-[10px] text-ink-placeholder">Camera off</span>}
    </div>
  );
}
