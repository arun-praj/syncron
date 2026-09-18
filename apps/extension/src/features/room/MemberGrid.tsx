import { avatarGlyphSrc } from "@/components/AvatarGlyph";
import { MicMiniIcon, MicOffMiniIcon } from "@/features/room/room-icons";
import type { RoomMember } from "@/features/room/room-mock-data";

function MuteButton({
  member,
  size,
  iconSize,
  onToggle,
}: {
  member: RoomMember;
  size: string;
  iconSize: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={member.muted ? `Unmute ${member.name}` : `Mute ${member.name}`}
      className={`flex ${size} flex-shrink-0 items-center justify-center rounded-full text-white ${
        member.muted ? "bg-[rgba(220,38,38,0.85)]" : "bg-[rgba(0,0,0,0.55)]"
      }`}>
      {member.muted ? <MicOffMiniIcon className={iconSize} /> : <MicMiniIcon className={iconSize} />}
    </button>
  );
}

function BufferingBadge({ variant }: { variant: "compact" | "grid" }) {
  if (variant === "compact") {
    return (
      <div className="mt-0.5 flex items-center justify-center gap-1">
        <span className="h-[5px] w-[5px] flex-shrink-0 rounded-full bg-amber-500" />
        <span className="text-[9.5px] text-ink-placeholder">Buffering…</span>
      </div>
    );
  }
  return (
    <div className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-black/55 px-1.5 py-0.5">
      <span className="h-[5px] w-[5px] flex-shrink-0 rounded-full bg-amber-500" />
      <span className="text-[9px] font-medium text-white">Buffering…</span>
    </div>
  );
}

export function MemberGrid({
  members,
  onToggleMute,
}: {
  members: RoomMember[];
  onToggleMute: (id: string) => void;
}) {
  const compact = members.length > 4;

  return (
    <div className="flex-shrink-0 border-b border-border px-[18px] py-2.5">
      {compact ? (
        <div className="flex gap-2.5 overflow-x-auto pb-0.5">
          {members.map((member) => (
            <div key={member.id} className="w-[104px] flex-shrink-0 text-center">
              <div className="relative mb-1 h-[78px] w-[104px] overflow-hidden rounded-[10px] bg-zinc-900">
                <img src={avatarGlyphSrc(member.avatarId)} alt="" className="h-full w-full object-cover" />
                <div className="absolute bottom-1 right-1">
                  <MuteButton
                    member={member}
                    size="h-[26px] w-[26px]"
                    iconSize="h-3.5 w-3.5"
                    onToggle={() => onToggleMute(member.id)}
                  />
                </div>
              </div>
              <span className="block truncate text-[11px] font-medium text-neutral-600">{member.name}</span>
              {!member.synced && <BufferingBadge variant="compact" />}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {members.map((member) => (
            <div key={member.id} className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-zinc-900">
              <img src={avatarGlyphSrc(member.avatarId)} alt="" className="h-full w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-gradient-to-t from-black/65 to-transparent px-2 pb-1.5 pt-4">
                <span className="min-w-0 flex-1 truncate text-[11.5px] font-semibold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.4)]">
                  {member.name}
                </span>
                {member.isHost && (
                  <span className="flex-shrink-0 rounded-full bg-[rgba(37,99,235,0.9)] px-1.5 py-0.5 text-[8.5px] font-semibold text-white">
                    Host
                  </span>
                )}
              </div>
              {!member.synced && <BufferingBadge variant="grid" />}
              <div className="absolute right-1.5 top-1.5">
                <MuteButton
                  member={member}
                  size="h-[22px] w-[22px]"
                  iconSize="h-3 w-3"
                  onToggle={() => onToggleMute(member.id)}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
