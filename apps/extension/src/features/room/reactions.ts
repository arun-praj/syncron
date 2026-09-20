export interface RoomReaction {
  id: string;
  label: string;
  icon: string;
}

export const ROOM_REACTIONS: RoomReaction[] = [
  { id: "thumbs-up", label: "Thumbs up", icon: "/emoji/thumbs-up.png" },
  { id: "joy", label: "Tears of joy", icon: "/emoji/face-with-tears-of-joy.png" },
  { id: "heart", label: "Heart", icon: "/emoji/red-heart.png" },
  { id: "party", label: "Party popper", icon: "/emoji/party-popper.png" },
  { id: "scream", label: "Screaming", icon: "/emoji/face-screaming-in-fear.png" },
  { id: "cry", label: "Crying", icon: "/emoji/loudly-crying-face.png" },
  { id: "open-mouth", label: "Surprised", icon: "/emoji/face-with-open-mouth.png" },
  { id: "fire", label: "Fire", icon: "/emoji/fire.png" },
];

const REACTION_TOKEN_PREFIX = "[[syncron-reaction:v1:";
const REACTION_TOKEN_SUFFIX = "]]";

export function encodeReaction(reaction: RoomReaction): string {
  return `${REACTION_TOKEN_PREFIX}${reaction.id}${REACTION_TOKEN_SUFFIX}`;
}

export function decodeReaction(message: string): RoomReaction | null {
  if (!message.startsWith(REACTION_TOKEN_PREFIX) || !message.endsWith(REACTION_TOKEN_SUFFIX)) return null;
  const id = message.slice(REACTION_TOKEN_PREFIX.length, -REACTION_TOKEN_SUFFIX.length);
  return ROOM_REACTIONS.find((reaction) => reaction.id === id) ?? null;
}
