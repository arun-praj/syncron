import { useRef, useState } from "react";

import { ChevronLeftIcon } from "@/components/icons";
import { InviteHintOverlay } from "@/features/room/InviteHintOverlay";
import { MemberGrid } from "@/features/room/MemberGrid";
import { RoomChat } from "@/features/room/RoomChat";
import {
  CameraMiniIcon,
  CameraOffMiniIcon,
  ClipboardIcon,
  LeaveIcon,
  MicMiniIcon,
  MicOffMiniIcon,
} from "@/features/room/room-icons";
import { ROOM_MOCK_MEMBERS, type RoomMember } from "@/features/room/room-mock-data";
import { usePlaybackSnapshot } from "@/hooks/usePlaybackSnapshot";
import { formatPlaybackTime } from "@/lib/format-time";
import type { PlaybackSnapshot } from "@/lib/playback-messages";
import type { StreamingService } from "@/lib/streaming-services";

export default function RoomScreen({
  service,
  tabId,
  tabTitle,
  inviteUrl,
  onBack,
  onLeave,
  readPlaybackSnapshot,
}: {
  service: StreamingService;
  tabId: number;
  tabTitle: string;
  inviteUrl: string;
  onBack: () => void;
  onLeave: () => void;
  readPlaybackSnapshot?: () => Promise<PlaybackSnapshot | null>;
}) {
  const liveSnapshot = usePlaybackSnapshot(
    service.id === "YOUTUBE" ? tabId : null,
    readPlaybackSnapshot,
  );
  const videoTitle = liveSnapshot?.title ?? tabTitle;
  const isPlaying = liveSnapshot ? !liveSnapshot.paused : false;
  const timeLabel = liveSnapshot ? formatPlaybackTime(liveSnapshot.currentTime) : "--:--";

  const [members, setMembers] = useState<RoomMember[]>(ROOM_MOCK_MEMBERS);
  const [selfMuted, setSelfMuted] = useState(true);
  const [selfVideoOff, setSelfVideoOff] = useState(false);
  const [copyLabel, setCopyLabel] = useState("Copy invite link");
  // Every current path into RoomScreen is a freshly created room (there's
  // no "rejoin an existing room" flow yet), so a just-started party always
  // has zero other members — show the invite hint every time, not just
  // the lifetime-first party.
  const [showHint, setShowHint] = useState(true);
  const inviteButtonRef = useRef<HTMLButtonElement>(null);

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
    } catch {
      // Link stays visible in the hint card for manual copying if
      // clipboard access is denied.
    }
    setCopyLabel("Copied!");
    setTimeout(() => setCopyLabel("Copy invite link"), 1500);
  };

  const dismissHint = () => setShowHint(false);

  const toggleMemberMute = (id: string) => {
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, muted: !m.muted } : m)));
  };

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <div className="flex flex-shrink-0 items-center gap-2.5 border-b border-border px-[18px] py-3.5">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to party setup"
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-ink-primary transition-colors hover:bg-neutral-100">
          <ChevronLeftIcon />
        </button>
        <span className="flex-1 text-logo font-bold tracking-[-0.01em] text-ink-primary">Watch party</span>
        <button
          ref={inviteButtonRef}
          type="button"
          onClick={() => void copyInvite()}

className="flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-blue-100 px-2.5 py-1.5 text-[12px] font-semibold text-blue-700 transition-colors hover:bg-blue-200">
          <ClipboardIcon className="h-3.5 w-3.5" />
          {copyLabel}
        </button>
        <button
          type="button"
          onClick={onLeave}
          aria-label="Leave party"
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-red-600 transition-colors hover:bg-red-50">
          <LeaveIcon className="h-[18px] w-[18px]" />
        </button>
      </div>

      <div className="flex flex-shrink-0 items-center gap-2 border-b border-border bg-neutral-50 px-[18px] py-2.5">
        <span
          className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${isPlaying ? "bg-green-500" : "bg-neutral-300"}`}
        />
        <span className="min-w-0 flex-1 truncate text-[11.5px] font-medium text-ink-label">{videoTitle}</span>
        <span className="flex-shrink-0 text-[11px] font-medium text-ink-placeholder">
          {isPlaying ? "Playing" : "Paused"} · {timeLabel}
        </span>
        {/* Sized like the app's other primary media controls (see
            components/IconButton.tsx's 40px default) — the original
            design mock specified 24px circles with 11px icons for these,
            which is where the "too small" complaint actually came from;
            matching the mock more closely would not have fixed it. */}
        <div className="ml-1 flex flex-shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setSelfMuted((v) => !v)}
            aria-label={selfMuted ? "Unmute yourself" : "Mute yourself"}
            className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
              selfMuted
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-neutral-200 text-ink-primary hover:bg-neutral-300"
            }`}>
            {selfMuted ? <MicOffMiniIcon className="h-[18px] w-[18px]" /> : <MicMiniIcon className="h-[18px] w-[18px]" />}
          </button>
          <button
            type="button"
            onClick={() => setSelfVideoOff((v) => !v)}
            aria-label={selfVideoOff ? "Turn camera on" : "Turn camera off"}
            className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
              selfVideoOff
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-neutral-200 text-ink-primary hover:bg-neutral-300"
            }`}>
            {selfVideoOff ? (
              <CameraOffMiniIcon className="h-[18px] w-[18px]" />
            ) : (
              <CameraMiniIcon className="h-[18px] w-[18px]" />
            )}
          </button>
        </div>
      </div>

      {showHint && (
        <InviteHintOverlay
          inviteUrl={inviteUrl}
          copyLabel={copyLabel}
          targetRef={inviteButtonRef}
          onCopy={() => void copyInvite()}
          onClose={dismissHint}
        />
      )}

      <MemberGrid members={members} onToggleMute={toggleMemberMute} />

      <RoomChat />
    </div>
  );
}
