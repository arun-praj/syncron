import { useState } from "react";
import { browser, type PublicPath } from "wxt/browser";

import { isRateLimited } from "@/auth-flow";
import { Button } from "@/components/Button";
import { ChevronLeftIcon, PeopleIcon } from "@/components/icons";
import { formatPlaybackTime } from "@/lib/format-time";
import type { PlaybackSnapshot } from "@/lib/playback-messages";
import type { StreamingService } from "@/lib/streaming-services";
import { api, ApiError } from "@/services/api/client";
import { usePlaybackSnapshot } from "@/hooks/usePlaybackSnapshot";

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
    <img
      src={browser.runtime.getURL(service.icon.replace(/^\/+/, ""))}
      alt=""
      className="h-[34px] w-[34px] flex-shrink-0 rounded-[9px]"
    />
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
  onEnterRoom: (inviteUrl: string) => void;
  readPlaybackSnapshot?: () => Promise<PlaybackSnapshot | null>;
}) {
  const liveSnapshot = usePlaybackSnapshot(
    service.id === "YOUTUBE" ? tabId : null,
    readPlaybackSnapshot,
  );
  const detailLine = liveSnapshot
    ? `${liveSnapshot.title} (${formatPlaybackTime(liveSnapshot.currentTime)})`
    : tabTitle;

  const [allowControl, setAllowControl] = useState(false);
  const [allowShare, setAllowShare] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startParty = async () => {
    setIsStarting(true);
    setError(null);
    try {
      const { inviteUrl } = await api.createRoom({
        name: tabTitle.slice(0, 100),
        everyoneCanControl: allowControl,
        allowMembersToShareInvite: allowShare,
        media: { provider: service.id, mediaId: null, url: tabUrl },
      });
      onEnterRoom(inviteUrl);
    } catch (e) {
      setError(startPartyErrorMessage(e));
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-shrink-0 items-center gap-2.5 border-b border-border px-[18px] py-3.5">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to home"
          className="flex h-[26px] w-[26px] items-center justify-center rounded-lg text-ink-label transition-colors hover:bg-neutral-100">
          <ChevronLeftIcon />
        </button>
        <span className="text-[14px] font-bold tracking-[-0.01em] text-ink-primary">
          Start a watch party
        </span>
      </div>

      <div className="flex flex-1 flex-col">
        <div className="flex flex-shrink-0 items-center gap-2.5 px-[18px] pb-1.5 pt-4">
          <img
            src={browser.runtime.getURL(service.icon as PublicPath)}
            alt=""
            className="h-[34px] w-[34px] flex-shrink-0 rounded-[9px]"
          />
          <div className="min-w-0">
            <div className="text-[13px] font-semibold tracking-[-0.005em] text-ink-primary">
              {service.name} detected
            </div>
            <div className="truncate text-[11.5px] text-ink-placeholder">{detailLine}</div>
          </div>
        </div>

        <div className="flex-1 px-[18px] pb-5 pt-[18px]">
          <div className="mb-2.5 px-0.5 text-[11px] font-medium uppercase tracking-[0.05em] text-ink-placeholder">
            Party permissions
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-border p-3.5">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[9px] bg-blue-50">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                <path d="M8 5V19L19 12L8 5Z" fill="#2563eb" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-semibold tracking-[-0.005em] text-ink-primary">
                Let members control playback
              </div>
              <p className="mt-[3px] text-[12px] leading-relaxed text-ink-secondary">
                Anyone in the room can play, pause, seek, and mute for everyone.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={allowControl}
              aria-label="Let members control playback"
              onClick={() => setAllowControl((v) => !v)}
              className={`relative mt-0.5 h-[22px] w-[38px] flex-shrink-0 rounded-full transition-colors duration-150 ${
                allowControl ? "bg-accent" : "bg-neutral-300"
              }`}>
              <span
                className={`absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.2)] transition-[left] duration-150 ${
                  allowControl ? "left-[18px]" : "left-0.5"
                }`}
              />
            </button>
          </div>

          <div className="mt-2.5 flex items-start gap-3 rounded-xl border border-border p-3.5">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[9px] bg-blue-50">
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
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-semibold tracking-[-0.005em] text-ink-primary">
                Allow members to share the invite link
              </div>
              <p className="mt-[3px] text-[12px] leading-relaxed text-ink-secondary">
                Anyone in the room can copy and send the link to others.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={allowShare}
              aria-label="Allow members to share the invite link"
              onClick={() => setAllowShare((v) => !v)}
              className={`relative mt-0.5 h-[22px] w-[38px] flex-shrink-0 rounded-full transition-colors duration-150 ${
                allowShare ? "bg-accent" : "bg-neutral-300"
              }`}>
              <span
                className={`absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.2)] transition-[left] duration-150 ${
                  allowShare ? "left-[18px]" : "left-0.5"
                }`}
              />
            </button>
          </div>

          {error && <p className="mt-3 text-[11.5px] text-red-500">{error}</p>}

          <Button
            type="button"
            className="mt-5"
            icon={<PeopleIcon />}
            disabled={isStarting}
            onClick={() => void startParty()}>
            {isStarting ? "Starting…" : "Start watch party"}
          </Button>
        </div>
      </div>
    </div>
  );
}
