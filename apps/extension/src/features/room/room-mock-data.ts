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

// Plain emoji instead of the design mock's external animated-PNG URLs —
// avoids depending on a third-party image host at runtime for a purely
// decorative reaction.
export const ROOM_REACTIONS = ["👍", "😂", "❤️", "🎉", "😱", "😭", "😮", "🔥"];
