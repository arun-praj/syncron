// Fixture data for the room screen's member grid and chat. Room
// membership/chat are real backend features that aren't wired up yet (see
// docs/implementation-plan.md) — this is UI-only, same as
// features/chat/ChatPanel and features/call/CallOverlay.
export interface RoomMember {
  id: string;
  name: string;
  avatarId: string;
  isHost: boolean;
  muted: boolean;
  synced: boolean;
}

export const ROOM_MOCK_MEMBERS: RoomMember[] = [
  { id: "you", name: "You", avatarId: "1", isHost: true, muted: true, synced: true },
];

export interface RoomChatMessage {
  id: string;
  kind: "system" | "chat";
  authorName?: string;
  avatarId?: string;
  time?: string;
  text: string;
}

export const ROOM_MOCK_MESSAGES: RoomChatMessage[] = [];

export interface RoomReaction {
  id: string;
  label: string;
  icon: string;
}

// Microsoft's Fluent Emoji ("modern" style), self-hosted under
// public/emoji/ (see public/emoji/NOTICE for provenance/license) instead
// of the design mock's external animated-PNG URLs — those would silently
// fail to load inside the YouTube in-page sidebar, since the host page's
// CSP blocks the cross-origin fetch (the same issue fixed for the Inter
// font import).
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
