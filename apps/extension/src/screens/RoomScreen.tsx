import { useRef } from "react";

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
import { usePlaybackSnapshot } from "@/hooks/usePlaybackSnapshot";
import { formatPlaybackTime } from "@/lib/format-time";
import { useRoomStore } from "@/stores/room-store";

export default function RoomScreen({ onBack, onLeave }: { onBack: () => void; onLeave: () => void }) {
  const identity = useRoomStore((s) => s.identity);
  const copyLabel = useRoomStore((s) => s.copyLabel);
  const copyInvite = useRoomStore((s) => s.copyInvite);
  const showInviteHint = useRoomStore((s) => s.showInviteHint);
  const selfMuted = useRoomStore((s) => s.selfMuted);
  const selfVideoOff = useRoomStore((s) => s.selfVideoOff);
  const toggleSelfMute = useRoomStore((s) => s.toggleSelfMute);
  const toggleSelfVideo = useRoomStore((s) => s.toggleSelfVideo);
  const leaveRoom = useRoomStore((s) => s.leaveRoom);

  const liveSnapshot = usePlaybackSnapshot(
    identity?.service.id === "YOUTUBE" ? identity.tabId : null,
    identity?.readPlaybackSnapshot,
  );
  const inviteButtonRef = useRef<HTMLButtonElement>(null);

  // Guards a render race between leaveRoom() clearing identity and the
  // parent's onLeave prop swapping this screen out — never user-visible.
  if (!identity) return null;

  const videoTitle = liveSnapshot?.title ?? identity.tabTitle;
  const isPlaying = liveSnapshot ? !liveSnapshot.paused : false;
  const timeLabel = liveSnapshot ? formatPlaybackTime(liveSnapshot.currentTime) : "--:--";
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
            aria-label={selfMuted ? "Unmute yourself" : "Mute yourself"}
            className="self-btn"
            style={{ background: selfMuted ? "rgba(220,38,38,0.9)" : "#eff6ff" }}>
            {selfMuted ? <MicOffMiniIcon color="#fff" /> : <MicMiniIcon color="#2563eb" />}
          </button>
          <button
            type="button"
            onClick={toggleSelfVideo}
            aria-label={selfVideoOff ? "Turn camera on" : "Turn camera off"}
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
