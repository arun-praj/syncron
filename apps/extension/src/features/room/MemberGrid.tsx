import { avatarGlyphSrc } from "@/components/AvatarGlyph";
import { MicMiniIcon, MicOffMiniIcon } from "@/features/room/icons";
import { useRoomStore, type RoomMember } from "@/stores/room-store";

// Member-tile mute icons are always white regardless of muted state in the
// design (only the button's background swaps red/black) — unlike the
// status-bar self-controls, which tint the icon blue when unmuted.
function MuteButton({
  member,
  className,
  onToggle,
}: {
  member: RoomMember;
  className: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={member.muted ? `Unmute ${member.name}` : `Mute ${member.name}`}
      className={className}
      style={{ background: member.muted ? "rgba(220,38,38,0.85)" : "rgba(0,0,0,0.55)" }}>
      {member.muted ? <MicOffMiniIcon color="#fff" /> : <MicMiniIcon color="#fff" />}
    </button>
  );
}

export function MemberGrid() {
  const members = useRoomStore((s) => s.members);
  const toggleMemberMute = useRoomStore((s) => s.toggleMemberMute);

  // Nothing else to show tiles for when the host is alone in the room.
  if (members.length <= 1) return null;

  const compact = members.length > 4;

  return compact ? (
    <div className="members-strip">
      <div className="strip-row">
        {members.map((member) => (
          <div key={member.id} className="strip-tile">
            <div className="strip-video">
              <img src={avatarGlyphSrc(member.avatarId)} alt={member.name} />
              <MuteButton member={member} className="mute-btn-sm" onToggle={() => toggleMemberMute(member.id)} />
            </div>
            <span className="strip-name">{member.name}</span>
            {!member.synced && (
              <div className="sync-badge-inline">
                <span className="sync-dot" />
                <span className="sync-text">Buffering…</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  ) : (
    <div className="members-grid-wrap">
      <div className="members-grid">
        {members.map((member) => (
          <div key={member.id} className="grid-tile">
            <img src={avatarGlyphSrc(member.avatarId)} alt={member.name} />
            <div className="grid-name-bar">
              <span className="grid-name">{member.name}</span>
              {member.isHost && <span className="host-badge">Host</span>}
            </div>
            {!member.synced && (
              <div className="sync-badge-overlay">
                <span className="sync-dot" />
                <span className="sync-text">Buffering…</span>
              </div>
            )}
            <MuteButton member={member} className="mute-btn-grid" onToggle={() => toggleMemberMute(member.id)} />
          </div>
        ))}
      </div>
    </div>
  );
}
