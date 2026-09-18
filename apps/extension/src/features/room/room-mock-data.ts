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
  { id: "alex", name: "Alex", avatarId: "7", isHost: false, muted: true, synced: false },
  { id: "priya", name: "Priya", avatarId: "12", isHost: false, muted: true, synced: true },
  { id: "sam", name: "Sam", avatarId: "18", isHost: false, muted: false, synced: true },
];

export interface RoomChatMessage {
  id: string;
  kind: "system" | "chat";
  authorName?: string;
  avatarId?: string;
  time?: string;
  text: string;
}

export const ROOM_MOCK_MESSAGES: RoomChatMessage[] = [
  { id: "m1", kind: "system", text: "Alex joined the party" },
  { id: "m2", kind: "chat", authorName: "Alex", avatarId: "7", time: "2:41 PM", text: "okay ready when you are" },
  { id: "m3", kind: "chat", authorName: "You", avatarId: "1", time: "2:41 PM", text: "same, starting in 3... 2... 1" },
  { id: "m4", kind: "system", text: "You paused the video at 12:04" },
  { id: "m5", kind: "chat", authorName: "Alex", avatarId: "7", time: "2:42 PM", text: "this scene is so good" },
  { id: "m6", kind: "system", text: "Alex skipped to 14:32" },
];

// Plain emoji instead of the design mock's external animated-PNG URLs —
// avoids depending on a third-party image host at runtime for a purely
// decorative reaction.
export const ROOM_REACTIONS = ["👍", "😂", "❤️", "🎉", "😱", "😭", "😮", "🔥"];
