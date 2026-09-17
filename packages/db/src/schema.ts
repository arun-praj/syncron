import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
const date = (name: string) => integer(name, { mode: "timestamp_ms" });
export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .notNull()
    .default(false),
  image: text("image"),
  createdAt: date("created_at").notNull(),
  updatedAt: date("updated_at").notNull(),
});
export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: date("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: date("created_at").notNull(),
    updatedAt: date("updated_at").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
  },
  (t) => [index("session_user").on(t.userId)],
);
export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: date("access_token_expires_at"),
    refreshTokenExpiresAt: date("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: date("created_at").notNull(),
    updatedAt: date("updated_at").notNull(),
  },
  (t) => [index("account_user").on(t.userId)],
);
export const verification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: date("expires_at").notNull(),
    createdAt: date("created_at").notNull(),
    updatedAt: date("updated_at").notNull(),
  },
  (t) => [index("verification_identifier").on(t.identifier)],
);
export const profiles = sqliteTable("user_profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id),
  username: text("username").notNull(),
  avatarId: text("avatar_id"),
  onboardingCompletedAt: date("onboarding_completed_at"),
  createdAt: date("created_at").notNull(),
  updatedAt: date("updated_at").notNull(),
});
export const rooms = sqliteTable(
  "rooms",
  {
    id: text("id").primaryKey(),
    name: text("name"),
    creatorUserId: text("creator_user_id")
      .notNull()
      .references(() => user.id),
    hostUserId: text("host_user_id")
      .notNull()
      .references(() => user.id),
    status: text("status", { enum: ["ACTIVE", "ENDED"] })
      .notNull()
      .default("ACTIVE"),
    inviteVersion: integer("invite_version").notNull().default(1),
    mediaProvider: text("media_provider", {
      enum: ["GENERIC", "YOUTUBE", "SPOTIFY", "NETFLIX"],
    }),
    mediaId: text("media_id"),
    mediaUrl: text("media_url"),
    everyoneCanControl: integer("everyone_can_control", { mode: "boolean" })
      .notNull()
      .default(true),
    maxParticipants: integer("max_participants").notNull().default(25),
    createdAt: date("created_at").notNull(),
    updatedAt: date("updated_at").notNull(),
    endedAt: date("ended_at"),
  },
  (t) => [
    check("room_status", sql`${t.status} IN ('ACTIVE','ENDED')`),
    check("room_capacity", sql`${t.maxParticipants}=25`),
    check("room_invite_version", sql`${t.inviteVersion}>=1`),
    check("room_end", sql`(${t.status}='ENDED')=(${t.endedAt} IS NOT NULL)`),
    index("room_host").on(t.hostUserId),
    index("room_creator").on(t.creatorUserId),
    index("room_status_created").on(t.status, t.createdAt),
  ],
);
export const memberships = sqliteTable(
  "room_memberships",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id")
      .notNull()
      .references(() => rooms.id),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    role: text("role", { enum: ["HOST", "MEMBER"] }).notNull(),
    joinedAt: date("joined_at").notNull(),
    leftAt: date("left_at"),
    leaveReason: text("leave_reason", {
      enum: ["LEFT", "KICKED", "ROOM_ENDED", "DISCONNECTED_TIMEOUT"],
    }),
    microphoneAllowed: integer("microphone_allowed", { mode: "boolean" })
      .notNull()
      .default(true),
  },
  (t) => [
    uniqueIndex("membership_active")
      .on(t.roomId, t.userId)
      .where(sql`${t.leftAt} IS NULL`),
    index("membership_room").on(t.roomId, t.joinedAt),
    index("membership_user").on(t.userId, t.joinedAt),
    check("membership_role", sql`${t.role} IN ('HOST','MEMBER')`),
    check(
      "membership_reason",
      sql`${t.leaveReason} IS NULL OR ${t.leaveReason} IN ('LEFT','KICKED','ROOM_ENDED','DISCONNECTED_TIMEOUT')`,
    ),
  ],
);
