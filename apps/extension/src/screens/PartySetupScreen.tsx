import { useState } from "react";

import { isRateLimited } from "@/auth-flow";
import { Button } from "@/components/Button";
import { CheckIcon, ChevronLeftIcon } from "@/components/icons";
import type { StreamingService } from "@/lib/streaming-services";
import { api, ApiError } from "@/services/api/client";

function startPartyErrorMessage(error: unknown): string {
  if (error instanceof ApiError && isRateLimited(error.status, error.code)) {
    return "You've started a lot of parties recently. Try again in a bit.";
  }
  return "Couldn't start the party. Please try again.";
}

export default function PartySetupScreen({
  service,
  tabTitle,
  tabUrl,
  onBack,
}: {
  service: StreamingService;
  tabTitle: string;
  tabUrl: string;
  onBack: () => void;
}) {
  const [allowControl, setAllowControl] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const startParty = async () => {
    setIsStarting(true);
    setError(null);
    try {
      const { inviteUrl } = await api.createRoom({
        name: tabTitle.slice(0, 100),
        everyoneCanControl: allowControl,
        media: { provider: service.id, mediaId: null, url: tabUrl },
      });
      setInviteUrl(inviteUrl);
    } catch (e) {
      setError(startPartyErrorMessage(e));
    } finally {
      setIsStarting(false);
    }
  };

  const copyInvite = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard write can be denied depending on document focus; the
      // link stays visible in the input for the user to copy by hand.
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
        <span className="text-logo font-bold tracking-[-0.01em] text-ink-primary">
          Start a watch party
        </span>
      </div>

      {inviteUrl ? (
        <PartyStartedView inviteUrl={inviteUrl} copied={copied} onCopy={() => void copyInvite()} onDone={onBack} />
      ) : (
        <div className="flex flex-1 flex-col">
          <div className="flex flex-shrink-0 items-center gap-2.5 px-[18px] pb-1.5 pt-4">
            <img src={service.icon} alt="" className="h-[34px] w-[34px] flex-shrink-0 rounded-[9px]" />
            <div className="min-w-0">
              <div className="text-[13px] font-semibold tracking-[-0.005em] text-ink-primary">
                {service.name} detected
              </div>
              <div className="truncate text-[11.5px] text-ink-placeholder">{tabTitle}</div>
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
                  className={`absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-[left] duration-150 ${
                    allowControl ? "left-[18px]" : "left-0.5"
                  }`}
                />
              </button>
            </div>

            <p className="mt-2.5 px-0.5 text-[11.5px] leading-relaxed text-ink-placeholder">
              Off by default — only you control playback until you turn this on.
            </p>

            {error && <p className="mt-3 text-[11.5px] text-red-500">{error}</p>}

            <Button
              type="button"
              className="mt-5"
              disabled={isStarting}
              onClick={() => void startParty()}>
              {isStarting ? "Starting…" : "Start watch party"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function PartyStartedView({
  inviteUrl,
  copied,
  onCopy,
  onDone,
}: {
  inviteUrl: string;
  copied: boolean;
  onCopy: () => void;
  onDone: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center px-[18px] pb-5 pt-8 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-50">
        <CheckIcon className="h-5 w-5 text-green-600" />
      </div>
      <h2 className="text-[15px] font-bold tracking-[-0.01em] text-ink-primary">Party started</h2>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-secondary">
        Share this link so friends can join and watch in sync.
      </p>

      <div className="mt-5 flex w-full items-center gap-2 rounded-input border border-border-input bg-neutral-50 py-1 pl-3 pr-1">
        <span className="min-w-0 flex-1 truncate text-left text-[12px] text-ink-label">{inviteUrl}</span>
        <button
          type="button"
          onClick={onCopy}
          className="flex-shrink-0 rounded-lg bg-white px-2.5 py-1.5 text-[12px] font-semibold text-accent shadow-sm hover:bg-blue-50">
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <Button type="button" variant="secondary" className="mt-6" onClick={onDone}>
        Done
      </Button>
    </div>
  );
}
