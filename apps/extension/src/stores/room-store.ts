import { create } from "zustand";

import type { PlaybackSnapshot } from "@/lib/playback-messages";
import type { StreamingService } from "@/lib/streaming-services";

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

export interface RoomIdentity {
  service: StreamingService;
  tabId: number;
  tabTitle: string;
  inviteUrl: string;
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

// Room membership/chat are real backend features that aren't wired up yet
// (see docs/implementation-plan.md) — UI-only, same as features/chat/ChatPanel.
// A freshly created room always starts with just the host.
const INITIAL_MEMBERS: RoomMember[] = [
  { id: "you", name: "You", avatarId: "1", isHost: true, muted: true, synced: true },
];

interface RoomState {
  identity: RoomIdentity | null;
  copyLabel: string;
  showInviteHint: boolean;

  selfMuted: boolean;
  selfVideoOff: boolean;

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

  members: INITIAL_MEMBERS,
  messages: [],
  draft: "",
  isPeerTyping: false,

  showReactionPicker: false,
  floatingReactions: [],

  enterRoom: (identity) =>
    set({
      identity,
      members: INITIAL_MEMBERS,
      messages: [],
      draft: "",
      isPeerTyping: false,
      selfMuted: true,
      selfVideoOff: false,
      showReactionPicker: false,
      floatingReactions: [],
      copyLabel: "Copy invite link",
      showInviteHint: inviteHintUnseen(),
    }),

  leaveRoom: () => set({ identity: null }),

  copyInvite: async () => {
    const { identity } = get();
    if (!identity) return;
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

  toggleSelfMute: () => set((s) => ({ selfMuted: !s.selfMuted })),
  toggleSelfVideo: () => set((s) => ({ selfVideoOff: !s.selfVideoOff })),

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
