import { and, eq, isNull } from "drizzle-orm";
import type { Database } from "../../../packages/db/src/index.js";
import {
  memberships,
  profiles,
  rooms,
  user,
} from "../../../packages/db/src/schema.js";
import { DomainError, newId } from "../../../packages/shared/src/index.js";
import type { z } from "zod";
import type { mediaDestination } from "../../../packages/protocol/src/index.js";
type MediaDestination = z.infer<typeof mediaDestination>;

export class Store {
  constructor(public db: Database) {}
  async room(id: string) {
    const row = await this.db.query.rooms.findFirst({
      where: eq(rooms.id, id),
    });
    if (!row) throw new DomainError("ROOM_NOT_FOUND", 404);
    return row;
  }
  async publicUser(id: string) {
    const row = await this.db
      .select({
        id: user.id,
        username: profiles.username,
        avatarId: profiles.avatarId,
        displayName: user.name,
        image: user.image,
      })
      .from(user)
      .innerJoin(profiles, eq(profiles.userId, user.id))
      .where(eq(user.id, id));
    if (!row[0]) throw new DomainError("USER_NOT_FOUND", 404);
    return row[0];
  }
  async dto(id: string, navigation?: { media: MediaDestination | null; hasPlaybackState: boolean }) {
    const r = await this.room(id);
    const media = navigation?.media ?? (r.mediaProvider && r.mediaUrl
      ? { provider: r.mediaProvider, mediaId: r.mediaId, url: r.mediaUrl }
      : null);
    return {
      id: r.id,
      name: r.name,
      status: r.status,
      everyoneCanControl: r.everyoneCanControl,
      maxParticipants: 25 as const,
      host: await this.publicUser(r.hostUserId),
      createdAt: r.createdAt.toISOString(),
      endedAt: r.endedAt?.toISOString() ?? null,
      media,
      hasPlaybackState: navigation?.hasPlaybackState ?? false,
    };
  }
  active(roomId: string) {
    return this.db
      .select()
      .from(memberships)
      .where(and(eq(memberships.roomId, roomId), isNull(memberships.leftAt)));
  }
  async member(roomId: string, userId: string) {
    return (await this.active(roomId)).find((m) => m.userId === userId);
  }
  async create(
    userId: string,
    name?: string,
    options: { everyoneCanControl?: boolean; media?: MediaDestination | null } = {},
  ) {
    const now = new Date();
    const id = newId();
    this.db.transaction(() => {
      [
        this.db
          .insert(rooms)
          .values({
            id,
            name,
            creatorUserId: userId,
            hostUserId: userId,
            everyoneCanControl: options.everyoneCanControl ?? true,
            mediaProvider: options.media?.provider,
            mediaId: options.media?.mediaId,
            mediaUrl: options.media?.url,
            createdAt: now,
            updatedAt: now,
          }),
        this.db
          .insert(memberships)
          .values({
            id: newId(),
            roomId: id,
            userId,
            role: "HOST",
            joinedAt: now,
          }),
      ].forEach((query) => query.run());
    });
    return id;
  }
  async profile(userId: string) {
    return this.db.query.profiles.findFirst({ where: eq(profiles.userId, userId) });
  }
  async completeOnboarding(userId: string, input: { username: string; avatarId: string; displayName?: string }) {
    const now = new Date();
    this.db.transaction(() => {
      this.db.update(profiles).set({ username: input.username, avatarId: input.avatarId, onboardingCompletedAt: now, updatedAt: now }).where(eq(profiles.userId, userId)).run();
      if (input.displayName) this.db.update(user).set({ name: input.displayName, updatedAt: now }).where(eq(user.id, userId)).run();
    });
  }
  async updateProfile(userId: string, input: { username?: string; avatarId?: string; displayName?: string }) {
    const now = new Date();
    this.db.transaction(() => {
      if (input.username || input.avatarId) this.db.update(profiles).set({ ...(input.username ? { username: input.username } : {}), ...(input.avatarId ? { avatarId: input.avatarId } : {}), updatedAt: now }).where(eq(profiles.userId, userId)).run();
      if (input.displayName) this.db.update(user).set({ name: input.displayName, updatedAt: now }).where(eq(user.id, userId)).run();
    });
  }
  async onboarded(userId: string) {
    return Boolean((await this.profile(userId))?.onboardingCompletedAt);
  }
  async setMicrophoneAllowed(roomId: string, userId: string, allowed: boolean) {
    await this.db.update(memberships).set({ microphoneAllowed: allowed }).where(and(eq(memberships.roomId, roomId), eq(memberships.userId, userId), isNull(memberships.leftAt)));
  }
  async join(roomId: string, userId: string, hostId: string) {
    const existing = await this.member(roomId, userId);
    if (existing) return existing;
    const m = {
      id: newId(),
      roomId,
      userId,
      role: hostId === userId ? ("HOST" as const) : ("MEMBER" as const),
      joinedAt: new Date(),
      microphoneAllowed: true,
    };
    await this.db.insert(memberships).values(m);
    return m;
  }
  async close(
    roomId: string,
    userId: string,
    reason: "LEFT" | "KICKED" | "DISCONNECTED_TIMEOUT",
  ) {
    await this.db
      .update(memberships)
      .set({ leftAt: new Date(), leaveReason: reason })
      .where(
        and(
          eq(memberships.roomId, roomId),
          eq(memberships.userId, userId),
          isNull(memberships.leftAt),
        ),
      );
  }
  async host(roomId: string, userId: string) {
    this.db.transaction(() => {
      [
        this.db
          .update(rooms)
          .set({ hostUserId: userId, updatedAt: new Date() })
          .where(eq(rooms.id, roomId)),
        this.db
          .update(memberships)
          .set({ role: "MEMBER" })
          .where(
            and(eq(memberships.roomId, roomId), isNull(memberships.leftAt)),
          ),
        this.db
          .update(memberships)
          .set({ role: "HOST" })
          .where(
            and(
              eq(memberships.roomId, roomId),
              eq(memberships.userId, userId),
              isNull(memberships.leftAt),
            ),
          ),
      ].forEach((query) => query.run());
    });
  }
  async end(roomId: string) {
    const now = new Date();
    this.db.transaction(() => {
      [
        this.db
          .update(rooms)
          .set({ status: "ENDED", endedAt: now, updatedAt: now })
          .where(and(eq(rooms.id, roomId), eq(rooms.status, "ACTIVE"))),
        this.db
          .update(memberships)
          .set({ leftAt: now, leaveReason: "ROOM_ENDED" })
          .where(
            and(eq(memberships.roomId, roomId), isNull(memberships.leftAt)),
          ),
      ].forEach((query) => query.run());
    });
  }
}
