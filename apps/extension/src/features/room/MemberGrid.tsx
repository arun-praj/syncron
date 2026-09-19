import { useEffect, useRef } from "react";

import { avatarGlyphSrc } from "@/components/AvatarGlyph";
import { MicMiniIcon, MicOffMiniIcon } from "@/features/room/icons";
import { useRoomStore, type RoomMember } from "@/stores/room-store";

function useMediaStreamTrack(track: MediaStreamTrack | null) {
  const ref = useRef<HTMLMediaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = track ? new MediaStream([track]) : null;
    return () => {
      el.srcObject = null;
    };
  }, [track]);
  return ref;
}

// A hidden audio element per remote member so their live mic is actually
// audible — being "subscribed" to a LiveKit track doesn't play sound by
// itself, it has to be attached to a playable media element. Skips self,
// since playing your own mic back to yourself would echo.
function MemberAudio({ member }: { member: RoomMember }) {
  const isSelf = useRoomStore((s) => s.identity?.selfUserId === member.id);
  const audioRef = useMediaStreamTrack(isSelf ? null : member.audioTrack);
  if (isSelf || !member.audioTrack) return null;
  return <audio ref={audioRef as React.RefObject<HTMLAudioElement>} autoPlay />;
}

// Renders a member's live camera feed when they have one, falling back to
// their avatar otherwise (camera off, muted, or not yet subscribed).
function MemberMedia({ member, className }: { member: RoomMember; className?: string }) {
  const videoRef = useMediaStreamTrack(member.videoTrack);
  if (!member.videoTrack) {
    return <img src={avatarGlyphSrc(member.avatarId)} alt={member.name} className={className} />;
  }
  return (
    <video
      ref={videoRef as React.RefObject<HTMLVideoElement>}
      autoPlay
      playsInline
      muted
      className={className}
    />
  );
}

// Member-tile mute icons are always white regardless of muted state in the
// design (only the button's background swaps red/black) — unlike the
// status-bar self-controls, which tint the icon blue when unmuted. No
// longer clickable: muted state now reflects each member's real LiveKit
// audio track, which isn't something another member can toggle for them.
function MuteBadge({ member, className }: { member: RoomMember; className: string }) {
  return (
    <div
      role="img"
      aria-label={member.muted ? `${member.name} is muted` : `${member.name} is unmuted`}
      className={className}
      style={{ background: member.muted ? "rgba(220,38,38,0.85)" : "rgba(0,0,0,0.55)" }}>
      {member.muted ? <MicOffMiniIcon color="#fff" /> : <MicMiniIcon color="#fff" />}
    </div>
  );
}

export function MemberGrid() {
  const members = useRoomStore((s) => s.members);

  // Nothing else to show tiles for when the host is alone in the room.
  if (members.length <= 1) return null;

  const compact = members.length > 4;

  return (
    <>
      {members.map((member) => (
        <MemberAudio key={member.id} member={member} />
      ))}
      {compact ? (
        <div className="members-strip">
          <div className="strip-row">
            {members.map((member) => (
              <div key={member.id} className="strip-tile">
                <div className="strip-video">
                  <MemberMedia member={member} />
                  <MuteBadge member={member} className="mute-btn-sm" />
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
                <MemberMedia member={member} />
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
                <MuteBadge member={member} className="mute-btn-grid" />
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
