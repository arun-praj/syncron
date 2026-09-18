import { useEffect, useRef, useState } from "react";
import { browser } from "wxt/browser";

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
import type { StreamingService } from "@/lib/streaming-services";

const INVITE_HINT_SEEN_KEY = "syncron_invite_hint_seen";

export default function RoomScreen({
  service,
  tabId,
  tabTitle,
  inviteUrl,
  onBack,
  onLeave,
}: {
  service: StreamingService;
  tabId: number;
  tabTitle: string;
  inviteUrl: string;
  onBack: () => void;
  onLeave: () => void;
}) {
  const liveSnapshot = usePlaybackSnapshot(service.id === "YOUTUBE" ? tabId : null);
  const videoTitle = liveSnapshot?.title ?? tabTitle;
  const isPlaying = liveSnapshot ? !liveSnapshot.paused : false;
  const timeLabel = liveSnapshot ? formatPlaybackTime(liveSnapshot.currentTime) : "--:--";

  const [members, setMembers] = useState<RoomMember[]>(ROOM_MOCK_MEMBERS);
  const [selfMuted, setSelfMuted] = useState(true);
  const [selfVideoOff, setSelfVideoOff] = useState(false);
  const [copyLabel, setCopyLabel] = useState("Copy invite link");
  const [showHint, setShowHint] = useState(false);
  const inviteButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let cancelled = false;
    void browser.storage.local.get(INVITE_HINT_SEEN_KEY).then((result) => {
      if (!cancelled && !result[INVITE_HINT_SEEN_KEY]) setShowHint(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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

  const dismissHint = () => {
    setShowHint(false);
    void browser.storage.local.set({ [INVITE_HINT_SEEN_KEY]: true });
  };

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
          className="flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-lg text-ink-label transition-colors hover:bg-neutral-100">
          <ChevronLeftIcon />
        </button>
        <span className="flex-1 text-logo font-bold tracking-[-0.01em] text-ink-primary">Watch party</span>
        <button
          ref={inviteButtonRef}
          type="button"
          onClick={() => void copyInvite()}
          className="flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-blue-50 px-2.5 py-1.5 text-[11px] font-semibold text-accent transition-colors hover:bg-blue-100">
          <ClipboardIcon className="h-3 w-3" />
          {copyLabel}
        </button>
        <button
          type="button"
          onClick={onLeave}
          aria-label="Leave party"
          className="flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-lg text-red-600 transition-colors hover:bg-red-50">
          <LeaveIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-shrink-0 items-center gap-2 border-b border-border bg-neutral-50 px-[18px] py-2">
        <span
          className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${isPlaying ? "bg-green-500" : "bg-neutral-300"}`}
        />
        <span className="min-w-0 flex-1 truncate text-[11.5px] font-medium text-ink-label">{videoTitle}</span>
        <span className="flex-shrink-0 text-[11px] font-medium text-ink-placeholder">
          {isPlaying ? "Playing" : "Paused"} · {timeLabel}
        </span>
        <div className="ml-1 flex flex-shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSelfMuted((v) => !v)}
            aria-label={selfMuted ? "Unmute yourself" : "Mute yourself"}
            className={`flex h-6 w-6 items-center justify-center rounded-full ${
              selfMuted ? "bg-red-600 text-white" : "bg-blue-50 text-accent"
            }`}>
            {selfMuted ? <MicOffMiniIcon className="h-2.5 w-2.5" /> : <MicMiniIcon className="h-2.5 w-2.5" />}
          </button>
          <button
            type="button"
            onClick={() => setSelfVideoOff((v) => !v)}
            aria-label={selfVideoOff ? "Turn camera on" : "Turn camera off"}
            className={`flex h-6 w-6 items-center justify-center rounded-full ${
              selfVideoOff ? "bg-red-600 text-white" : "bg-blue-50 text-accent"
            }`}>
            {selfVideoOff ? (
              <CameraOffMiniIcon className="h-2.5 w-2.5" />
            ) : (
              <CameraMiniIcon className="h-2.5 w-2.5" />
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
