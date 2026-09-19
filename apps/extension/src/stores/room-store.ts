import { create } from "zustand";

import type { PlaybackSnapshot } from "@/lib/playback-messages";
import type { StreamingService } from "@/lib/streaming-services";
import { api } from "@/services/api/client";

export interface RoomMember {
  id: string;
  name: string;
  avatarId: string;
  isHost: boolean;
  muted: boolean;
  synced: boolean;
}

export interface RoomChatMessage {
  id: string;
  kind: "system" | "chat";
  authorName?: string;
  avatarId?: string;
  time?: string;
  text: string;
}

export interface RoomReaction {
  id: string;
  label: string;
  icon: string;
}

export interface FloatingReaction {
  id: string;
  icon: string;
  left: number;
}

// A member's initial mic/sync UI state is always the same regardless of
// who they are (no real mic/buffering signal is wired up yet) — callers
// only need to supply identity, not the full RoomMember shape.
export interface RoomMemberSeed {
  id: string;
  name: string;
  avatarId: string;
  isHost: boolean;
}

export interface RoomIdentity {
  service: StreamingService;
  tabId: number;
  tabTitle: string;
  roomId: string;
  isHost: boolean;
  everyoneCanControl: boolean;
  // Whether *this* client is allowed to see/share an invite link — true
  // for the host always, true for a member only when the host has turned
  // on "let members share the invite".
  canShareInvite: boolean;
  inviteUrl: string | null;
  members: RoomMemberSeed[];
  readPlaybackSnapshot?: () => Promise<PlaybackSnapshot | null>;
}

// Self-hosted (see public/emoji/NOTICE) instead of the design's external
// animated-PNG URLs — those fail to load inside the YouTube in-page
// sidebar, since the host page's CSP blocks the cross-origin fetch.
export const ROOM_REACTIONS: RoomReaction[] = [
  { id: "thumbs-up", label: "Thumbs up", icon: "/emoji/thumbs-up.svg" },
  { id: "joy", label: "Tears of joy", icon: "/emoji/face-with-tears-of-joy.svg" },
  { id: "heart", label: "Heart", icon: "/emoji/red-heart.svg" },
  { id: "party", label: "Party popper", icon: "/emoji/party-popper.svg" },
  { id: "scream", label: "Screaming", icon: "/emoji/face-screaming-in-fear.svg" },
  { id: "cry", label: "Crying", icon: "/emoji/loudly-crying-face.svg" },
  { id: "open-mouth", label: "Surprised", icon: "/emoji/face-with-open-mouth.svg" },
  { id: "fire", label: "Fire", icon: "/emoji/fire.svg" },
];

// Real getUserMedia calls — LiveKit itself isn't wired up yet, so a grant
// is only ever used to check permission and then immediately released
// (stopping the tracks) rather than kept open with nothing consuming it.
async function requestMediaAccess(constraints: MediaStreamConstraints): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return false;
  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    stream.getTracks().forEach((track) => track.stop());
    return true;
  } catch {
    return false;
  }
}

interface RoomState {
  identity: RoomIdentity | null;
  copyLabel: string;
  showInviteHint: boolean;

  selfMuted: boolean;
  selfVideoOff: boolean;
  // True once a getUserMedia request for that device has been denied —
  // the self-mute/camera buttons re-prompt instead of just toggling while
  // this is true, since there's nothing to toggle without the permission.
  micBlocked: boolean;
  camBlocked: boolean;

  members: RoomMember[];
  messages: RoomChatMessage[];
  draft: string;
  // No backend signal for this exists yet, so nothing sets it true today —
  // kept as real state (rather than hardcoding it visible like the design
  // mock does) so a solo host never sees a fabricated "someone is typing".
  isPeerTyping: boolean;

  showReactionPicker: boolean;
  floatingReactions: FloatingReaction[];

  enterRoom: (identity: RoomIdentity) => void;
  leaveRoom: () => void;
  copyInvite: () => Promise<void>;
  dismissInviteHint: () => void;
  requestMediaPermissions: () => Promise<void>;
  toggleSelfMute: () => void;
  toggleSelfVideo: () => void;
  toggleMemberMute: (id: string) => void;
  setDraft: (draft: string) => void;
  sendMessage: () => void;
  toggleReactionPicker: () => void;
  sendReaction: (reaction: RoomReaction) => void;
}

function inviteHintUnseen(): boolean {
  return !localStorage.getItem("syncron_invite_hint_seen");
}

export const useRoomStore = create<RoomState>((set, get) => ({
  identity: null,
  copyLabel: "Copy invite link",
  showInviteHint: inviteHintUnseen(),

  selfMuted: true,
  selfVideoOff: false,
  micBlocked: false,
  camBlocked: false,

  members: [],
  messages: [],
  draft: "",
  isPeerTyping: false,

  showReactionPicker: false,
  floatingReactions: [],

  enterRoom: (identity) =>
    set({
      identity,
      members: identity.members.map((m) => ({ ...m, muted: true, synced: true })),
      messages: [],
      draft: "",
      isPeerTyping: false,
      selfMuted: true,
      selfVideoOff: false,
      micBlocked: false,
      camBlocked: false,
      showReactionPicker: false,
      floatingReactions: [],
      copyLabel: "Copy invite link",
      showInviteHint: inviteHintUnseen(),
    }),

  // Clears local state immediately (leaving always feels instant), then
  // best-effort tells the server — a failed request here shouldn't trap
  // the user in a room screen they've already left visually.
  leaveRoom: () => {
    const identity = get().identity;
    set({ identity: null });
    if (!identity) return;
    void (identity.isHost ? api.endRoom(identity.roomId) : api.leaveRoom(identity.roomId)).catch(
      () => undefined,
    );
  },

  copyInvite: async () => {
    const { identity } = get();
    if (!identity?.inviteUrl) return;
    try {
      await navigator.clipboard.writeText(identity.inviteUrl);
    } catch {
      // Link stays visible in the hint card / header for manual copying if
      // clipboard access is denied.
    }
    set({ copyLabel: "Copied!" });
    setTimeout(() => set({ copyLabel: "Copy invite link" }), 1500);
  },

  dismissInviteHint: () => {
    localStorage.setItem("syncron_invite_hint_seen", "1");
    set({ showInviteHint: false });
  },

  // Called once on room entry (both freshly hosting and joining) — asks
  // for mic/camera access up front so self-controls reflect what the
  // browser actually granted, instead of starting "on" and only failing
  // once the user tries to unmute.
  requestMediaPermissions: async () => {
    const [micGranted, camGranted] = await Promise.all([
      requestMediaAccess({ audio: true }),
      requestMediaAccess({ video: true }),
    ]);
    set({
      selfMuted: !micGranted,
      selfVideoOff: !camGranted,
      micBlocked: !micGranted,
      camBlocked: !camGranted,
    });
  },

  toggleSelfMute: () => {
    if (get().micBlocked) {
      void requestMediaAccess({ audio: true }).then((granted) => {
        if (granted) set({ selfMuted: false, micBlocked: false });
      });
      return;
    }
    set((s) => ({ selfMuted: !s.selfMuted }));
  },

  toggleSelfVideo: () => {
    if (get().camBlocked) {
      void requestMediaAccess({ video: true }).then((granted) => {
        if (granted) set({ selfVideoOff: false, camBlocked: false });
      });
      return;
    }
    set((s) => ({ selfVideoOff: !s.selfVideoOff }));
  },

  toggleMemberMute: (id) =>
    set((s) => ({
      members: s.members.map((m) => (m.id === id ? { ...m, muted: !m.muted } : m)),
    })),

  setDraft: (draft) => set({ draft }),

  sendMessage: () => {
    const text = get().draft.trim();
    if (!text) return;
    set((s) => ({
      messages: [
        ...s.messages,
        { id: `local-${Date.now()}`, kind: "chat", authorName: "You", avatarId: "1", time: "Now", text },
      ],
      draft: "",
    }));
  },

  toggleReactionPicker: () => set((s) => ({ showReactionPicker: !s.showReactionPicker })),

  sendReaction: (reaction) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    set((s) => ({
      floatingReactions: [...s.floatingReactions, { id, icon: reaction.icon, left: 15 + Math.random() * 60 }],
      showReactionPicker: false,
    }));
    setTimeout(() => {
      set((s) => ({ floatingReactions: s.floatingReactions.filter((r) => r.id !== id) }));
    }, 1800);
  },
}));
