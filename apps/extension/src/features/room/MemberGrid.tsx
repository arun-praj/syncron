import { avatarGlyphSrc } from "@/components/AvatarGlyph";
import { MicMiniIcon, MicOffMiniIcon } from "@/features/room/icons";
import { useRoomStore, type RoomMember } from "@/stores/room-store";

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
      <div className="mt-px flex items-center justify-center gap-[3px]">
        <span className="h-[5px] w-[5px] flex-shrink-0 rounded-full bg-[#f59e0b]" />
        <span className="text-[9.5px] text-ink-placeholder">Buffering…</span>
      </div>
    );
  }
  return (
    <div className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-[rgba(0,0,0,0.55)] py-0.5 pl-1.5 pr-[7px]">
      <span className="h-[5px] w-[5px] flex-shrink-0 rounded-full bg-[#f59e0b]" />
      <span className="text-[9px] font-medium text-white">Buffering…</span>
    </div>
  );
}

// Container-query breakpoints for `.room-member-grid` widening past 2
// columns live in style.css — Tailwind's viewport-width `md:`/`lg:` variants
// would key off the *page's* viewport, which is wrong for the YouTube
// in-page sidebar (a ~380px column inside a full-width host page).
export function MemberGrid() {
  const members = useRoomStore((s) => s.members);
  const toggleMemberMute = useRoomStore((s) => s.toggleMemberMute);

  // Nothing else to show tiles for when the host is alone in the room.
  if (members.length <= 1) return null;

  const compact = members.length > 4;

  return (
    <div className="flex-shrink-0 border-b border-border px-[18px] py-2.5">
      {compact ? (
        <div className="flex gap-2.5 overflow-x-auto pb-0.5">
          {members.map((member) => (
            <div key={member.id} className="w-[104px] flex-shrink-0 text-center">
              <div className="relative mb-1 h-[78px] w-[104px] overflow-hidden rounded-[10px] bg-[#18181b]">
                <img src={avatarGlyphSrc(member.avatarId)} alt="" className="h-full w-full object-cover" />
                <div className="absolute bottom-1 right-1">
                  <MuteButton
                    member={member}
                    size="h-[26px] w-[26px]"
                    iconSize="h-3.5 w-3.5"
                    onToggle={() => toggleMemberMute(member.id)}
                  />
                </div>
              </div>
              <span className="block truncate text-[11px] font-medium text-[#52525b]">{member.name}</span>
              {!member.synced && <BufferingBadge variant="compact" />}
            </div>
          ))}
        </div>
      ) : (
        <div className="room-member-grid grid grid-cols-2 gap-2">
          {members.map((member) => (
            <div key={member.id} className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-[#18181b]">
              <img src={avatarGlyphSrc(member.avatarId)} alt="" className="h-full w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-gradient-to-t from-[rgba(0,0,0,0.65)] to-transparent px-2 pb-1.5 pt-4">
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
                  onToggle={() => toggleMemberMute(member.id)}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
