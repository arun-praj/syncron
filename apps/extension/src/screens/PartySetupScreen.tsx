import { useState } from "react";
import { browser, type PublicPath } from "wxt/browser";

import { isRateLimited } from "@/auth-flow";
import { ChevronLeftIcon, PeopleIcon } from "@/components/icons";
import { formatPlaybackTime } from "@/lib/format-time";
import type { PlaybackSnapshot } from "@/lib/playback-messages";
import type { StreamingService } from "@/lib/streaming-services";
import "@/screens/PartySetupScreen.css";
import { api, ApiError } from "@/services/api/client";
import { usePlaybackSnapshot } from "@/hooks/usePlaybackSnapshot";
import { useAuthStore } from "@/stores/auth-store";
import { useRoomStore } from "@/stores/room-store";

function ServiceIcon({ service }: { service: StreamingService }) {
  if (service.id === "YOUTUBE") {
    return (
      <svg width="34" height="34" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="#FF0000"
          d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"
        />
      </svg>
    );
  }

  return (
    <img src={browser.runtime.getURL(service.icon as PublicPath)} alt="" width={34} height={34} style={{ borderRadius: 9, flexShrink: 0 }} />
  );
}

function startPartyErrorMessage(error: unknown): string {
  if (error instanceof ApiError && isRateLimited(error.status, error.code)) {
    return "You've started a lot of parties recently. Try again in a bit.";
  }
  return "Couldn't start the party. Please try again.";
}

export default function PartySetupScreen({
  service,
  tabId,
  tabTitle,
  tabUrl,
  onBack,
  onEnterRoom,
  readPlaybackSnapshot,
}: {
  service: StreamingService;
  tabId: number;
  tabTitle: string;
  tabUrl: string;
  onBack: () => void;
  onEnterRoom: () => void;
  readPlaybackSnapshot?: () => Promise<PlaybackSnapshot | null>;
}) {
  const liveSnapshot = usePlaybackSnapshot(
    service.id === "YOUTUBE" ? tabId : null,
    readPlaybackSnapshot,
  );
  const detailLine = liveSnapshot
    ? `${liveSnapshot.title} (${formatPlaybackTime(liveSnapshot.currentTime)})`
    : tabTitle;

  const selfUser = useAuthStore((s) => s.user);
  const enterRoom = useRoomStore((s) => s.enterRoom);

  const [allowControl, setAllowControl] = useState(false);
  const [allowShare, setAllowShare] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startParty = async () => {
    setIsStarting(true);
    setError(null);
    try {
      const { room, inviteUrl } = await api.createRoom({
        name: tabTitle.slice(0, 100),
        everyoneCanControl: allowControl,
        allowMembersToShareInvite: allowShare,
        media: { provider: service.id, mediaId: null, url: tabUrl },
      });
      enterRoom({
        service,
        tabId,
        tabTitle,
        roomId: room.id,
        isHost: true,
        everyoneCanControl: room.everyoneCanControl,
        canShareInvite: true,
        inviteUrl,
        members: [
          { id: room.host.id, name: "You", avatarId: selfUser?.avatarId ?? "1", isHost: true },
        ],
        readPlaybackSnapshot,
      });
      onEnterRoom();
    } catch (e) {
      setError(startPartyErrorMessage(e));
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div className="ps-screen">
      <div className="ps-header">
        <button type="button" onClick={onBack} aria-label="Back to home" className="ps-back">
          <ChevronLeftIcon />
        </button>
        <span className="ps-title">Start a watch party</span>
      </div>

      <div className="ps-service-row">
        <ServiceIcon service={service} />
        <div className="ps-service-text">
          <div className="ps-service-name">{service.name} detected</div>
          <div className="ps-service-detail">{detailLine}</div>
        </div>
      </div>

      <div className="ps-body">
        <div className="ps-section-label">Party permissions</div>

        <div className="ps-permission-card">
          <div className="ps-permission-icon">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
              <path d="M8 5V19L19 12L8 5Z" fill="#2563eb" />
            </svg>
          </div>
          <div className="ps-permission-text">
            <div className="ps-permission-title">Let members control playback</div>
            <p className="ps-permission-desc">
              Anyone in the room can play, pause, seek, and mute for everyone.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={allowControl}
            aria-label="Let members control playback"
            onClick={() => setAllowControl((v) => !v)}
            className="ps-toggle"
            style={{ background: allowControl ? "#2563eb" : "#d4d4d8" }}>
            <span className="ps-toggle-knob" style={{ left: allowControl ? "18px" : "2px" }} />
          </button>
        </div>

        <div className="ps-permission-card">
          <div className="ps-permission-icon">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
              <path
                d="M10 13a5 5 0 007 0l3-3a5 5 0 00-7-7l-1.5 1.5"
                stroke="#2563eb"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M14 11a5 5 0 00-7 0l-3 3a5 5 0 007 7l1.5-1.5"
                stroke="#2563eb"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="ps-permission-text">
            <div className="ps-permission-title">Allow members to share the invite link</div>
            <p className="ps-permission-desc">Anyone in the room can copy and send the link to others.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={allowShare}
            aria-label="Allow members to share the invite link"
            onClick={() => setAllowShare((v) => !v)}
            className="ps-toggle"
            style={{ background: allowShare ? "#2563eb" : "#d4d4d8" }}>
            <span className="ps-toggle-knob" style={{ left: allowShare ? "18px" : "2px" }} />
          </button>
        </div>

        {error && <p className="ps-error">{error}</p>}

        <button type="button" className="ps-start-btn" disabled={isStarting} onClick={() => void startParty()}>
          <PeopleIcon />
          {isStarting ? "Starting…" : "Start watch party"}
        </button>
      </div>
    </div>
  );
}
