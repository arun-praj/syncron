import { useEffect, useRef, useState } from "react";
import {
  CameraDisabledIcon,
  CameraIcon,
  MicDisabledIcon,
  MicIcon,
  RoomContext,
} from "@livekit/components-react";

import { InviteHintOverlay } from "@/features/room/InviteHintOverlay";
import {
  ClipboardIcon,
  LeaveIcon,
  SettingsIcon,
} from "@/features/room/icons";
import { MemberGrid } from "@/features/room/MemberGrid";
import "@/features/room/room.css";
import { RoomChat } from "@/features/room/RoomChat";
import { formatPlaybackTime } from "@/lib/format-time";
import { useRoomStore } from "@/stores/room-store";
import { formatMemberLabel } from "@/features/room/member-label";

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
  const autoplayBlocked = useRoomStore((s) => s.autoplayBlocked);
  const navigationWarning = useRoomStore((s) => s.navigationWarning);
  const dismissNavigationWarning = useRoomStore((s) => s.dismissNavigationWarning);
  const controlWarning = useRoomStore((s) => s.controlWarning);
  const dismissControlWarning = useRoomStore((s) => s.dismissControlWarning);
  const hostNotification = useRoomStore((s) => s.hostNotification);
  const clearHostNotification = useRoomStore((s) => s.clearHostNotification);
  const forceLeaveReason = useRoomStore((s) => s.forceLeaveReason);
  const liveKit = useRoomStore((s) => s.liveKit);
  const liveKitReady = useRoomStore((s) => s.liveKitReady);
  const activeGeneration = useRoomStore((s) => s.activeGeneration);
  const members = useRoomStore((s) => s.members);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [disbandParty, setDisbandParty] = useState(false);
  const [transferTo, setTransferTo] = useState("");
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);

  const inviteButtonRef = useRef<HTMLButtonElement>(null);

  // The server removed us from the room (kicked, or the host ended the
  // party) — identity is already cleared by forceLeave(); this just tells
  // the parent to navigate away, same as clicking "leave" would.
  useEffect(() => {
    if (forceLeaveReason) onLeave();
  }, [forceLeaveReason, onLeave]);

  useEffect(() => {
    if (!hostNotification) return;
    const timer = window.setTimeout(clearHostNotification, 7000);
    return () => window.clearTimeout(timer);
  }, [clearHostNotification, hostNotification]);

  // Guards a render race between leaveRoom()/forceLeave() clearing
  // identity and the parent's onLeave prop swapping this screen out —
  // never user-visible.
  if (!identity) return null;

  const otherMembers = members.filter((member) => !member.isHost);
  const hasOtherMembers = otherMembers.length > 0;
  const autoTransferTarget = otherMembers.length === 1 ? otherMembers[0] : null;

  const leave = async (options?: { disband?: boolean; transferTo?: string }) => {
    const generation = activeGeneration;
    const roomId = identity.roomId;
    setIsLeaving(true);
    setLeaveError(null);
    const left = await leaveRoom(options);
    const current = useRoomStore.getState();
    // A successful leave clears identity and bumps the generation, so that
    // normal completion must still reach onLeave(). Only suppress the old
    // continuation when a replacement room is now visible.
    if (current.identity && (current.activeGeneration !== generation || current.identity.roomId !== roomId)) return;
    setIsLeaving(false);
    if (!left) {
      setLeaveError("Couldn’t update the party. Please try again.");
      return;
    }
    setShowLeaveDialog(false);
    onLeave();
  };

  const openLeaveDialog = () => {
    if (!identity.isHost) {
      void leave();
      return;
    }
    setDisbandParty(!hasOtherMembers);
    setTransferTo(autoTransferTarget?.id ?? otherMembers[0]?.id ?? "");
    setLeaveError(null);
    setShowLeaveDialog(true);
  };

  const videoTitle = playbackState?.title ?? identity.tabTitle;
  const isPlaying = playbackState ? !playbackState.paused : false;
  const timeLabel = playbackState ? formatPlaybackTime(playbackState.position) : "--:--";
  const canShowInvite = identity.canShareInvite && identity.inviteUrl !== null;

  return (
    <div className="room-screen">
      <div className="header">
        <button
          type="button"
          onClick={identity.isHost ? onBack : openLeaveDialog}
          aria-label={identity.isHost ? "Open room settings" : "Exit room"}
          title={identity.isHost ? "Room settings" : "Exit room"}
          className="back">
          {identity.isHost ? <SettingsIcon /> : <LeaveIcon />}
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
          onClick={openLeaveDialog}
          aria-label={identity.isHost ? "Leave party" : "Exit room"}
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
            className={`self-btn ${selfMuted ? "self-btn--off" : "self-btn--on"}`}
            aria-pressed={!selfMuted}
            style={{ color: selfMuted ? "#fff" : "#111827" }}>
            {selfMuted ? <MicDisabledIcon className="self-btn-icon" aria-hidden="true" /> : <MicIcon className="self-btn-icon" aria-hidden="true" />}
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
            className={`self-btn ${selfVideoOff ? "self-btn--off" : "self-btn--on"}`}
            aria-pressed={!selfVideoOff}
            style={{ color: selfVideoOff ? "#fff" : "#111827" }}>
            {selfVideoOff ? <CameraDisabledIcon className="self-btn-icon" aria-hidden="true" /> : <CameraIcon className="self-btn-icon" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {showInviteHint && canShowInvite && <InviteHintOverlay targetRef={inviteButtonRef} />}

      {autoplayBlocked && (
        <div className="sync-banner" role="status">
          <span>Click the video once to allow synchronized playback.</span>
          <button type="button" onClick={() => void document.querySelector<HTMLVideoElement>("video")?.play()}>
            Resume
          </button>
        </div>
      )}

      {navigationWarning && (
        <div className="sync-banner" role="alert">
          <span>{navigationWarning}</span>
          <button type="button" onClick={dismissNavigationWarning}>Dismiss</button>
        </div>
      )}

      {controlWarning && (
        <div className="sync-banner" role="alert">
          <span>{controlWarning}</span>
          {identity.isHost && (
            <button type="button" onClick={dismissControlWarning}>Dismiss</button>
          )}
        </div>
      )}

      {hostNotification && (
        <div className="sync-banner" role="status">
          <span>{hostNotification}</span>
        </div>
      )}

      {showLeaveDialog && identity.isHost && (
        <div className="room-dialog-backdrop" role="presentation">
          <div className="room-dialog" role="dialog" aria-modal="true" aria-labelledby="leave-room-title">
            <h2 id="leave-room-title">Leave watch party?</h2>
            <p className="room-dialog-copy">
              Choose what should happen to the party when you leave as host.
            </p>
            <label className="room-dialog-toggle-row">
              <span>
                <strong>Disband the party</strong>
                <small>{hasOtherMembers ? "Everyone will be notified and removed." : "You are the only member."}</small>
              </span>
              <input
                type="checkbox"
                checked={disbandParty}
                disabled={!hasOtherMembers || isLeaving}
                onChange={(event) => setDisbandParty(event.target.checked)}
              />
            </label>
            {!disbandParty && hasOtherMembers && (
              <div className="room-dialog-field">
                {autoTransferTarget ? (
                  <p className="room-dialog-transfer-note">
                    Ownership will transfer automatically to {formatMemberLabel(autoTransferTarget, identity.selfUserId)}.
                  </p>
                ) : (
                  <>
                    <label htmlFor="room-transfer-target">Transfer host access to</label>
                    <select
                      id="room-transfer-target"
                      value={transferTo}
                      disabled={isLeaving}
                      onChange={(event) => setTransferTo(event.target.value)}>
                      <option value="">Select a member</option>
                      {otherMembers.map((member) => (
                        <option key={member.id} value={member.id}>
                          {formatMemberLabel(member, identity.selfUserId)}
                        </option>
                      ))}
                    </select>
                  </>
                )}
              </div>
            )}
            {leaveError && <p className="room-dialog-error" role="alert">{leaveError}</p>}
            <div className="room-dialog-actions">
              <button type="button" className="room-dialog-cancel" disabled={isLeaving} onClick={() => setShowLeaveDialog(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="room-dialog-confirm"
                disabled={isLeaving || (!disbandParty && !transferTo)}
                onClick={() => void leave({ disband: disbandParty, ...(disbandParty ? {} : { transferTo: autoTransferTarget?.id ?? transferTo }) })}>
                {isLeaving ? "Leaving…" : disbandParty ? "Disband party" : "Transfer & leave"}
              </button>
            </div>
          </div>
        </div>
      )}

      {liveKitReady && liveKit?.currentRoom ? (
        <RoomContext.Provider value={liveKit.currentRoom}>
          <MemberGrid />
          <RoomChat />
        </RoomContext.Provider>
      ) : (
        <MemberGrid />
      )}
    </div>
  );
}
