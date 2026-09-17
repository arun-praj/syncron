import { z } from "zod";
import { username } from "../../validation/src/index.js";
export const id = z.string().min(1).max(128);
export const roomId = z.uuidv7();
export const empty = z.strictObject({});
export const avatarId = z.enum([
  "1", "2", "3", "4", "5", "6", "7", "8", "9", "10",
  "11", "12", "13", "14", "15", "16", "17", "18", "19", "20",
  "21", "22", "23", "24", "25", "26", "27", "28", "29", "30",
]);
export const mediaProvider = z.enum(["GENERIC", "YOUTUBE", "SPOTIFY", "NETFLIX"]);
export const mediaDestination = z.strictObject({
  provider: mediaProvider,
  mediaId: z.string().max(512).nullable(),
  url: z.url().max(2048).refine((v) => /^https?:\/\//.test(v)),
});
export const profileUpdate = z
  .strictObject({
    username: username.optional(),
    displayName: z.string().trim().min(1).max(100).optional(),
    avatarId: avatarId.optional(),
  })
  .refine((v) => Object.keys(v).length > 0);
export const onboarding = z.strictObject({
  username,
  avatarId,
  displayName: z.string().trim().min(1).max(100).optional(),
});
export const createRoom = z.strictObject({
  name: z.string().trim().min(1).max(100).optional(),
  everyoneCanControl: z.boolean().default(true),
  media: mediaDestination,
});
export const joinRoom = z.strictObject({ invite: z.string().min(1).max(1024) });
export const settings = z.strictObject({ everyoneCanControl: z.boolean() });
export const targetUser = z.strictObject({ userId: id });
export const inviteClaims = z.strictObject({
  roomId,
  inviteVersion: z.number().int().positive(),
});
const position = z.number().finite().nonnegative();
const rate = z.number().min(0.25).max(4);
const media = { ...mediaDestination.shape, position };
const envelope = {
  requestId: id,
  sequence: z.number().int().nonnegative(),
  sentAt: z.number().finite().nonnegative(),
};
const event = <T extends string, S extends z.ZodType>(type: T, payload: S) =>
  z.strictObject({ ...envelope, type: z.literal(type), payload });
export const clientEvent = z.discriminatedUnion("type", [
  event("playback.sync_request", empty),
  event("client.ping", z.strictObject({ clientTime: z.number().finite() })),
  event("playback.play", z.strictObject(media)),
  event("playback.pause", z.strictObject(media)),
  event("playback.seek", z.strictObject(media)),
  event(
    "playback.rate_change",
    z.strictObject({ position, playbackRate: rate }),
  ),
  event(
    "playback.media_change",
    z.strictObject({
      ...media,
      paused: z.boolean(),
      metadata: z
        .strictObject({ title: z.string().max(200).optional() })
        .optional(),
    }),
  ),
  event(
    "playback.buffering",
    z.strictObject({ position, buffering: z.boolean() }),
  ),
]);
export const playbackState = z.object({
  ...media,
  paused: z.boolean(),
  playbackRate: rate,
  updatedAt: z.number(),
  updatedBy: id,
  stateSequence: z.number().int(),
  metadata: z.object({ title: z.string().max(200).optional() }).optional(),
});
export type PlaybackState = z.infer<typeof playbackState>;
export const publicUser = z.object({
  id,
  username,
  avatarId: avatarId.nullable(),
  displayName: z.string(),
  image: z.string().nullable(),
});
export const room = z.object({
  id: roomId,
  name: z.string().nullable(),
  status: z.enum(["ACTIVE", "ENDED"]),
  everyoneCanControl: z.boolean(),
  maxParticipants: z.literal(25),
  host: publicUser,
  createdAt: z.iso.datetime(),
  endedAt: z.iso.datetime().nullable(),
  media: mediaDestination.nullable(),
  hasPlaybackState: z.boolean(),
});
export const member = z.object({
  user: publicUser,
  role: z.enum(["HOST", "MEMBER"]),
  joinedAt: z.iso.datetime(),
  connected: z.boolean(),
  microphoneAllowed: z.boolean(),
});
const serverEnvelope = {
  eventId: roomId,
  serverSequence: z.number().int().positive(),
  serverTime: z.number().finite(),
};
const outgoing = <T extends string, S extends z.ZodType>(type: T, payload: S) =>
  z.object({ ...serverEnvelope, type: z.literal(type), payload });
export const serverEvent = z.discriminatedUnion("type", [
  outgoing(
    "connection.ready",
    z.object({
      connectionId: roomId,
      roomId,
      userId: id,
      serverTime: z.number(),
    }),
  ),
  outgoing("playback.state", playbackState),
  outgoing("playback.no_state", empty),
  outgoing(
    "playback.control_rejected",
    z.object({
      requestId: id,
      code: z.enum([
        "PLAYBACK_CONTROL_FORBIDDEN",
        "RATE_LIMITED",
        "NO_PLAYBACK_STATE",
      ]),
    }),
  ),
  outgoing(
    "playback.buffering",
    z.object({ userId: id, position, buffering: z.boolean() }),
  ),
  outgoing("room.member_joined", z.object({ member })),
  outgoing(
    "room.member_left",
    z.object({
      userId: id,
      reason: z.enum(["LEFT", "KICKED", "DISCONNECTED_TIMEOUT"]),
    }),
  ),
  outgoing("room.host_changed", z.object({ host: publicUser })),
  outgoing("room.settings_changed", settings),
  outgoing("room.member_microphone_changed", z.object({ userId: id, microphoneAllowed: z.boolean() })),
  outgoing("room.kicked", z.object({ reason: z.literal("KICKED_BY_HOST") })),
  outgoing(
    "room.ended",
    z.object({
      endedAt: z.iso.datetime(),
      reason: z.enum(["HOST_ENDED", "EMPTY_TIMEOUT"]),
    }),
  ),
  outgoing(
    "server.pong",
    z.object({ clientTime: z.number(), serverTime: z.number() }),
  ),
  outgoing(
    "protocol.error",
    z.object({
      requestId: id.optional(),
      code: z.enum(["VALIDATION_ERROR", "STALE_SEQUENCE"]),
      message: z.string(),
    }),
  ),
]);
export type ClientEvent = z.infer<typeof clientEvent>;
export type ServerEvent = z.infer<typeof serverEvent>;
export type PublicUser = z.infer<typeof publicUser>;
export type Room = z.infer<typeof room>;
export type RoomMember = z.infer<typeof member>;
export const meResponse = z.object({
  user: publicUser.extend({
    email: z.email(),
    emailVerified: z.boolean(),
    createdAt: z.iso.datetime(),
    onboardingCompletedAt: z.iso.datetime().nullable(),
  }),
});
export const roomResponse = z.object({ room });
export const inviteResponse = z.object({ inviteUrl: z.url() });
export const createRoomResponse = roomResponse.extend({ inviteUrl: z.url() });
export const joinRoomResponse = roomResponse.extend({
  membership: z.object({
    role: z.enum(["HOST", "MEMBER"]),
    joinedAt: z.iso.datetime(),
    microphoneAllowed: z.boolean(),
  }),
});
export const membersResponse = z.object({ members: z.array(member) });
export const hostResponse = z.object({ host: publicUser });
export const ticketResponse = z.object({
  ticket: z.string(),
  expiresAt: z.iso.datetime(),
});
export const livekitResponse = z.object({
  url: z.url(),
  token: z.string(),
  roomName: z.string(),
  participantIdentity: id,
});
export const onboardingResponse = meResponse;
export const microphonePermission = z.strictObject({ allowed: z.boolean() });
export const authExchangeStart = z.strictObject({
  challenge: z.string().min(32).max(256),
  redirectOrigin: z.url().max(512),
});
export const authExchangeConsume = z.strictObject({
  exchangeId: z.string().min(32).max(128),
  challenge: z.string().min(32).max(256),
  proof: z.string().min(32).max(256),
});
export const errorResponse = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: roomId,
    details: z.null(),
  }),
});
