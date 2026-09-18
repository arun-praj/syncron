import { useRef } from "react";

import { ChevronLeftIcon } from "@/components/icons";
import { InviteHintOverlay } from "@/features/room/InviteHintOverlay";
import { ClipboardIcon, LeaveIcon, MicMiniIcon, MicOffMiniIcon, CameraMiniIcon, CameraOffMiniIcon } from "@/features/room/icons";
import { MemberGrid } from "@/features/room/MemberGrid";
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

  return (
    <div className="room-screen relative flex h-full flex-col overflow-hidden">
      <div className="flex flex-shrink-0 items-center gap-2.5 border-b border-border px-[18px] py-3.5">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to party setup"
          className="flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-lg text-ink-label transition-colors hover:bg-[#f4f4f5]">
          <ChevronLeftIcon className="h-4 w-4" />
        </button>
        <span className="flex-1 text-[14px] font-bold tracking-[-0.01em] text-ink-primary">Watch party</span>
        <button
          ref={inviteButtonRef}
          type="button"
          onClick={() => void copyInvite()}
          className="flex flex-shrink-0 items-center gap-[5px] whitespace-nowrap rounded-full bg-[#eff6ff] px-[11px] py-1.5 text-[11px] font-semibold text-accent transition-colors hover:bg-[#dbeafe]">
          <ClipboardIcon className="h-3 w-3" />
          {copyLabel}
        </button>
        <button
          type="button"
          onClick={() => {
            leaveRoom();
            onLeave();
          }}
          aria-label="Leave party"
          className="flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-lg text-[#dc2626] transition-colors hover:bg-[#fef2f2]">
          <LeaveIcon className="h-[15px] w-[15px]" />
        </button>
      </div>

      <div className="flex flex-shrink-0 items-center gap-2 border-b border-border bg-[#fafafa] px-[18px] py-2">
        <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${isPlaying ? "bg-green-500" : "bg-[#a1a1aa]"}`} />
        <span className="min-w-0 flex-1 truncate text-[11.5px] font-medium text-ink-label">{videoTitle}</span>
        <span className="flex-shrink-0 text-[11px] font-medium text-ink-placeholder">
          {isPlaying ? "Playing" : "Paused"} · {timeLabel}
        </span>
        <div className="ml-1 flex flex-shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={toggleSelfMute}
            aria-label={selfMuted ? "Unmute yourself" : "Mute yourself"}
            className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${
              selfMuted ? "bg-[rgba(220,38,38,0.9)] text-white" : "bg-[#eff6ff] text-accent"
            }`}>
            {selfMuted ? <MicOffMiniIcon className="h-[11px] w-[11px]" /> : <MicMiniIcon className="h-[11px] w-[11px]" />}
          </button>
          <button
            type="button"
            onClick={toggleSelfVideo}
            aria-label={selfVideoOff ? "Turn camera on" : "Turn camera off"}
            className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${
              selfVideoOff ? "bg-[rgba(220,38,38,0.9)] text-white" : "bg-[#eff6ff] text-accent"
            }`}>
            {selfVideoOff ? (
              <CameraOffMiniIcon className="h-[11px] w-[11px]" />
            ) : (
              <CameraMiniIcon className="h-[11px] w-[11px]" />
            )}
          </button>
        </div>
      </div>

      {showInviteHint && <InviteHintOverlay targetRef={inviteButtonRef} />}

      <MemberGrid />

      <RoomChat />
    </div>
  );
}
