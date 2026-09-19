import { useEffect, useRef } from "react";

import { ChevronLeftIcon } from "@/components/icons";
import { InviteHintOverlay } from "@/features/room/InviteHintOverlay";
import {
  CameraMiniIcon,
  CameraOffMiniIcon,
  ClipboardIcon,
  LeaveIcon,
  MicMiniIcon,
  MicOffMiniIcon,
} from "@/features/room/icons";
import { MemberGrid } from "@/features/room/MemberGrid";
import "@/features/room/room.css";
import { RoomChat } from "@/features/room/RoomChat";
import { formatPlaybackTime } from "@/lib/format-time";
import { useRoomStore } from "@/stores/room-store";

export default function RoomScreen({ onBack, onLeave }: { onBack: () => void; onLeave: () => void }) {
  const identity = useRoomStore((s) => s.identity);
  const copyLabel = useRoomStore((s) => s.copyLabel);
  const copyInvite = useRoomStore((s) => s.copyInvite);
  const showInviteHint = useRoomStore((s) => s.showInviteHint);
  const selfMuted = useRoomStore((s) => s.selfMuted);
  const selfVideoOff = useRoomStore((s) => s.selfVideoOff);
  const micBlocked = useRoomStore((s) => s.micBlocked);
  const camBlocked = useRoomStore((s) => s.camBlocked);
  const toggleSelfMute = useRoomStore((s) => s.toggleSelfMute);
  const toggleSelfVideo = useRoomStore((s) => s.toggleSelfVideo);
  const leaveRoom = useRoomStore((s) => s.leaveRoom);
  const playbackState = useRoomStore((s) => s.playbackState);
  const forceLeaveReason = useRoomStore((s) => s.forceLeaveReason);

  const inviteButtonRef = useRef<HTMLButtonElement>(null);

  // The server removed us from the room (kicked, or the host ended the
  // party) — identity is already cleared by forceLeave(); this just tells
  // the parent to navigate away, same as clicking "leave" would.
  useEffect(() => {
    if (forceLeaveReason) onLeave();
  }, [forceLeaveReason, onLeave]);

  // Guards a render race between leaveRoom()/forceLeave() clearing
  // identity and the parent's onLeave prop swapping this screen out —
  // never user-visible.
  if (!identity) return null;

  const videoTitle = playbackState?.title ?? identity.tabTitle;
  const isPlaying = playbackState ? !playbackState.paused : false;
  const timeLabel = playbackState ? formatPlaybackTime(playbackState.position) : "--:--";
  const canShowInvite = identity.canShareInvite && identity.inviteUrl !== null;

  return (
    <div className="room-screen">
      <div className="header">
        <button type="button" onClick={onBack} aria-label="Back to party setup" className="back">
          <ChevronLeftIcon />
        </button>
        <span className="title">Watch party</span>
        {canShowInvite && (
          <button ref={inviteButtonRef} type="button" onClick={() => void copyInvite()} className="copy-btn">
            <ClipboardIcon width={12} height={12} />
            {copyLabel}
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            leaveRoom();
            onLeave();
          }}
          aria-label="Leave party"
          className="leave-btn">
          <LeaveIcon />
        </button>
      </div>

      <div className="status-bar">
        <span className="status-dot" style={{ background: isPlaying ? "#22c55e" : "#a1a1aa" }} />
        <span className="status-title">{videoTitle}</span>
        <span className="status-time">
          {isPlaying ? "Playing" : "Paused"} · {timeLabel}
        </span>
        <div className="self-controls">
          <button
            type="button"
            onClick={toggleSelfMute}
            aria-label={
              micBlocked ? "Microphone blocked — click to allow" : selfMuted ? "Unmute yourself" : "Mute yourself"
            }
            title={micBlocked ? "Microphone blocked — click to allow" : undefined}
            className="self-btn"
            style={{ background: selfMuted ? "rgba(220,38,38,0.9)" : "#eff6ff" }}>
            {selfMuted ? <MicOffMiniIcon color="#fff" /> : <MicMiniIcon color="#2563eb" />}
          </button>
          <button
            type="button"
            onClick={toggleSelfVideo}
            aria-label={
              camBlocked
                ? "Camera blocked — click to allow"
                : selfVideoOff
                  ? "Turn camera on"
                  : "Turn camera off"
            }
            title={camBlocked ? "Camera blocked — click to allow" : undefined}
            className="self-btn"
            style={{ background: selfVideoOff ? "rgba(220,38,38,0.9)" : "#eff6ff" }}>
            {selfVideoOff ? <CameraOffMiniIcon color="#fff" /> : <CameraMiniIcon color="#2563eb" />}
          </button>
        </div>
      </div>

      {showInviteHint && canShowInvite && <InviteHintOverlay targetRef={inviteButtonRef} />}

      <MemberGrid />

      <RoomChat />
    </div>
  );
}
