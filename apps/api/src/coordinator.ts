import { eq } from "drizzle-orm";
import { rooms } from "../../../packages/db/src/schema.js";
import {
  clientEvent,
  serverEvent,
  mediaDestination,
  youtubeMediaId,
  type PlaybackState,
} from "../../../packages/protocol/src/index.js";
import type { z } from "zod";
type MediaDestination = z.infer<typeof mediaDestination>;

function sameMediaDestination(a: MediaDestination, b: MediaDestination) {
  if (a.provider !== b.provider) return false;
  if (a.provider === "YOUTUBE") {
    const aId = youtubeMediaId(a.url);
    const bId = youtubeMediaId(b.url);
    return aId !== null && aId === bId &&
      (a.mediaId === null || a.mediaId === aId) &&
      (b.mediaId === null || b.mediaId === bId);
  }
  return a.mediaId === b.mediaId && a.url === b.url;
}

function isActiveHostConflict(error: unknown) {
  return error instanceof Error &&
    error.message.includes("UNIQUE constraint failed: rooms.host_user_id");
}

const descriptorBearingEvents = new Set([
  "playback.play",
  "playback.pause",
  "playback.seek",
  "playback.media_change",
]);
import {
  DomainError,
  MemoryRateLimiter,
  newId,
  log,
} from "../../../packages/shared/src/index.js";
import type { Store } from "./store.js";
import type { MediaService } from "./livekit.js";
export interface Socket {
  send(data: string): void;
  close(code?: number, reason?: string): void;
}
type Presence = {
  socket?: Socket;
  connectionId?: string;
  connectedAt: number;
  disconnectedAt?: number;
  lastSeen: number;
  sequence: number;
};
export interface RoomCoordinator {
  authorize(userId: string, host?: boolean): Promise<void>;
  join(userId: string): Promise<unknown>;
  initializeMedia(
    media: MediaDestination,
    userId: string,
    initialPlayback?: {
      position: number;
      paused: boolean;
      playbackRate: number;
      muted: boolean;
      volume: number;
    },
  ): Promise<void>;
  navigation(): Promise<{ media: MediaDestination | null; hasPlaybackState: boolean; title: string | null }>;
  connect(userId: string, socket: Socket): Promise<string>;
  disconnect(userId: string, connectionId: string): Promise<void>;
  receive(userId: string, connectionId: string, input: unknown): Promise<void>;
  leave(userId: string, kicked?: boolean, options?: { disband?: boolean; transferTo?: string }): Promise<void>;
  transfer(userId: string): Promise<void>;
  settings(value: boolean): Promise<void>;
  members(): Promise<unknown[]>;
  end(reason: "HOST_ENDED" | "EMPTY_TIMEOUT"): Promise<void>;
  setMicrophoneAllowed(userId: string, allowed: boolean): Promise<void>;
  tick(): Promise<void>;
}
export class MemoryRoomCoordinator implements RoomCoordinator {
  private presence = new Map<string, Presence>();
  private state: PlaybackState | null = null;
  private serverSequence = 0;
  private stateSequence = 0;
  private pendingSeek = false;
  private seekDue = 0;
  private ended = false;
  private cleanupPending = new Set<string>();
  private endCleanupPending = false;
  private nextCleanupAt = 0;
  private limiter: MemoryRateLimiter;
  constructor(
    readonly id: string,
    private store: Store,
    private media: MediaService,
    private now = () => Date.now(),
  ) {
    this.limiter = new MemoryRateLimiter(now);
  }
  async recover() {
    for (const m of await this.store.active(this.id))
      this.presence.set(m.userId, {
        connectedAt: 0,
        disconnectedAt: this.now(),
        lastSeen: this.now(),
        sequence: -1,
      });
  }
  async authorize(userId: string, host = false) {
    const r = await this.store.room(this.id);
    if (this.ended || r.status === "ENDED")
      throw new DomainError("ROOM_ENDED", 409);
    if (!(await this.store.member(this.id, userId)))
      throw new DomainError("NOT_ROOM_MEMBER");
    if (host && r.hostUserId !== userId) throw new DomainError("NOT_ROOM_HOST");
  }
  async join(userId: string) {
    if (this.cleanupPending.has(userId))
      throw new DomainError("LIVEKIT_TOKEN_UNAVAILABLE", 503);
    const r = await this.store.room(this.id);
    if (this.ended || r.status === "ENDED")
      throw new DomainError("ROOM_ENDED", 409);
    const active = await this.store.active(this.id);
    if (!active.some((m) => m.userId === userId) && active.length >= 25)
      throw new DomainError("ROOM_FULL", 409);
    const membership = await this.store.join(this.id, userId, r.hostUserId);
    if (!this.presence.has(userId))
      this.presence.set(userId, {
        connectedAt: 0,
        disconnectedAt: this.now(),
        lastSeen: this.now(),
        sequence: -1,
      });
    return {
      role: membership.role,
      joinedAt: membership.joinedAt.toISOString(),
      microphoneAllowed: membership.microphoneAllowed,
    };
  }
  async initializeMedia(
    media: MediaDestination,
    userId: string,
    initialPlayback = {
      position: 0,
      paused: true,
      playbackRate: 1,
      muted: false,
      volume: 1,
    },
  ) {
    if (this.state) return;
    this.state = {
      ...media,
      ...initialPlayback,
      updatedAt: this.now(),
      updatedBy: userId,
      stateSequence: ++this.stateSequence,
    };
  }
  async navigation() {
    if (this.state) return {
      media: { provider: this.state.provider, mediaId: this.state.mediaId, url: this.state.url },
      hasPlaybackState: true,
      title: this.state.metadata?.title ?? null,
    };
    const room = await this.store.room(this.id);
    return {
      media: room.mediaProvider && room.mediaUrl ? { provider: room.mediaProvider, mediaId: room.mediaId, url: room.mediaUrl } : null,
      hasPlaybackState: false,
      title: room.name ?? null,
    };
  }
  private send(type: string, payload: unknown, socket?: Socket) {
    const data = JSON.stringify(
      serverEvent.parse({
        type,
        eventId: newId(),
        serverSequence: ++this.serverSequence,
        serverTime: this.now(),
        payload,
      }),
    );
    for (const s of socket
      ? [socket]
      : [...this.presence.values()].flatMap((p) =>
          p.socket ? [p.socket] : [],
        )) {
      try {
        s.send(data);
      } catch {
        s.close(1011, "Send failed");
      }
    }
  }
  private sync(socket?: Socket) {
    this.send(
      this.state ? "playback.state" : "playback.no_state",
      this.state ?? {},
      socket,
    );
  }
  private flush() {
    if (this.pendingSeek) {
      this.pendingSeek = false;
      this.sync();
    }
  }
  async connect(userId: string, socket: Socket) {
    await this.authorize(userId);
    this.flush();
    const previous = this.presence.get(userId);
    const connectionId = newId();
    const now = this.now();
    this.presence.set(userId, {
      socket,
      connectionId,
      connectedAt: previous?.socket ? previous.connectedAt : now,
      lastSeen: now,
      sequence: -1,
    });
    previous?.socket?.close(4001, "Connection replaced");
    this.send(
      "connection.ready",
      { connectionId, roomId: this.id, userId, serverTime: now },
      socket,
    );
    this.sync(socket);
    const member = (await this.members()).find((m) => m.user.id === userId);
    this.send("room.member_joined", { member });
    return connectionId;
  }
  async disconnect(userId: string, connectionId: string) {
    const p = this.presence.get(userId);
    if (!p || p.connectionId !== connectionId || !p.socket) return;
    p.socket = undefined;
    p.disconnectedAt = this.now();
  }
  private connected() {
    return [...this.presence.entries()]
      .filter(([, p]) => p.socket)
      .sort(
        ([a, x], [b, y]) => x.connectedAt - y.connectedAt || a.localeCompare(b),
      );
  }
  private async selectNextHost(excluded = new Set<string>()): Promise<string | null> {
    const candidates = [] as string[];
    for (const [userId] of this.connected()) {
      if (excluded.has(userId)) continue;
      if (!(await this.store.member(this.id, userId))) continue;
      if (await this.store.activeOwnedRoom(userId)) continue;
      candidates.push(userId);
    }
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)]!;
  }
  async members() {
    const r = await this.store.room(this.id);
    return Promise.all(
      (await this.store.active(this.id)).map(async (m) => ({
        user: await this.store.publicUser(m.userId),
        role: m.userId === r.hostUserId ? "HOST" : "MEMBER",
        joinedAt: m.joinedAt.toISOString(),
        connected: !!this.presence.get(m.userId)?.socket,
        microphoneAllowed: m.microphoneAllowed,
      })),
    );
  }
  async transfer(userId: string) {
    if (
      !this.presence.get(userId)?.socket ||
      !(await this.store.member(this.id, userId))
    )
      throw new DomainError("INVALID_HOST_TRANSFER", 409);
    const ownedRoom = await this.store.activeOwnedRoom(userId);
    if (ownedRoom && ownedRoom.id !== this.id)
      throw new DomainError("INVALID_HOST_TRANSFER", 409);
    try {
      await this.store.host(this.id, userId);
    } catch (error) {
      if (isActiveHostConflict(error))
        throw new DomainError("INVALID_HOST_TRANSFER", 409);
      throw error;
    }
    this.send("room.host_changed", {
      host: await this.store.publicUser(userId),
    });
  }
  private async transferOrEnd() {
    const excluded = new Set<string>();
    while (true) {
      const next = await this.selectNextHost(excluded);
      if (!next) {
        await this.end("EMPTY_TIMEOUT");
        return;
      }
      try {
        await this.transfer(next);
        return;
      } catch (error) {
        if (error instanceof DomainError && error.code === "INVALID_HOST_TRANSFER") {
          excluded.add(next);
          continue;
        }
        throw error;
      }
    }
  }
  async leave(userId: string, kicked = false, options: { disband?: boolean; transferTo?: string } = {}) {
    if (!(await this.store.member(this.id, userId))) return;
    await this.authorize(userId);
    const r = await this.store.room(this.id);
    const wasHost = r.hostUserId === userId;
    if (!kicked && (options.disband || options.transferTo) && r.hostUserId !== userId)
      throw new DomainError("NOT_ROOM_HOST");
    if (!kicked && options.disband) {
      await this.end("HOST_ENDED");
      return;
    }
    if (!kicked && r.hostUserId === userId && options.transferTo) {
      if (options.transferTo === userId) throw new DomainError("CANNOT_TRANSFER_TO_SELF");
      await this.transfer(options.transferTo);
    }
    const p = this.presence.get(userId);
    await this.store.close(this.id, userId, kicked ? "KICKED" : "LEFT");
    if (kicked && p?.socket)
      this.send("room.kicked", { reason: "KICKED_BY_HOST" }, p.socket);
    this.presence.delete(userId);
    p?.socket?.close(4003, kicked ? "Kicked" : "Left");
    this.send("room.member_left", {
      userId,
      reason: kicked ? "KICKED" : "LEFT",
    });
    if (wasHost && !options.transferTo) await this.transferOrEnd();
    await this.removeMedia(userId);
  }
  async settings(value: boolean) {
    this.flush();
    await this.store.db
      .update(rooms)
      .set({ everyoneCanControl: value, updatedAt: new Date(this.now()) })
      .where(eq(rooms.id, this.id));
    this.send("room.settings_changed", { everyoneCanControl: value });
  }
  async setMicrophoneAllowed(userId: string, allowed: boolean) {
    await this.authorize(userId);
    await this.store.setMicrophoneAllowed(this.id, userId, allowed);
    this.send("room.member_microphone_changed", { userId, microphoneAllowed: allowed });
  }
  async receive(userId: string, connectionId: string, input: unknown) {
    const p = this.presence.get(userId);
    if (!p?.socket || p.connectionId !== connectionId) return;
    await this.authorize(userId);
    const parsed = clientEvent.safeParse(input);
    if (!parsed.success) {
      this.send(
        "protocol.error",
        { code: "VALIDATION_ERROR", message: "Invalid playback event" },
        p.socket,
      );
      return;
    }
    const e = parsed.data;
    p.lastSeen = this.now();
    if (e.sequence <= p.sequence) {
      this.send(
        "protocol.error",
        {
          requestId: e.requestId,
          code: "STALE_SEQUENCE",
          message: "Sequence must increase",
        },
        p.socket,
      );
      return;
    }
    p.sequence = e.sequence;
    if (!this.limiter.take(`events:${userId}`, 30, 1000, 60)) {
      this.send(
        "playback.control_rejected",
        { requestId: e.requestId, code: "RATE_LIMITED" },
        p.socket,
      );
      return;
    }
    if (e.type === "client.ping") {
      this.send(
        "server.pong",
        { clientTime: e.payload.clientTime, serverTime: this.now() },
        p.socket,
      );
      return;
    }
    if (e.type === "playback.sync_request") {
      this.sync(p.socket);
      return;
    }
    if (e.type === "playback.buffering") {
      this.send("playback.buffering", { userId, ...e.payload });
      return;
    }
    const room = await this.store.room(this.id);
    if (room.hostUserId !== userId && !room.everyoneCanControl) {
      this.send(
        "playback.control_rejected",
        { requestId: e.requestId, code: "PLAYBACK_CONTROL_FORBIDDEN" },
        p.socket,
      );
      return;
    }
    if ((e.type === "playback.rate_change" || e.type === "playback.audio_change") && !this.state) {
      this.send(
        "playback.control_rejected",
        { requestId: e.requestId, code: "NO_PLAYBACK_STATE" },
        p.socket,
      );
      return;
    }
    const preservesPendingSeek = this.pendingSeek && e.type !== "playback.media_change" && e.type !== "playback.seek";
    const pendingSeekPosition = preservesPendingSeek ? this.state?.position : undefined;
    if (e.type !== "playback.seek") this.flush();
    const old = this.state;
    const payload = pendingSeekPosition === undefined || !("position" in e.payload)
      ? e.payload
      : { ...e.payload, position: pendingSeekPosition };
    const seekPaused =
      e.type === "playback.seek" && "paused" in e.payload
        ? (e.payload as { paused?: boolean }).paused
        : undefined;
    const destination = descriptorBearingEvents.has(e.type)
      ? e.payload as MediaDestination
      : null;
    const persistedMedia = room.mediaProvider && room.mediaUrl
      ? { provider: room.mediaProvider, mediaId: room.mediaId, url: room.mediaUrl }
      : null;
    const sameMedia = !!old && !!destination && sameMediaDestination(
      { provider: old.provider, mediaId: old.mediaId, url: old.url },
      destination,
    );
    const destinationAllowed = old
      ? sameMedia
      : room.hostUserId === userId &&
        (!persistedMedia || (!!destination && sameMediaDestination(persistedMedia, destination)));
    if (destination && ((!old && e.type !== "playback.media_change") || !destinationAllowed)) {
      if (old) this.sync(p.socket);
      else this.send(
        "playback.control_rejected",
        { requestId: e.requestId, code: "NO_PLAYBACK_STATE" },
        p.socket,
      );
      return;
    }
    const nextAudio = {
      muted: "muted" in payload ? payload.muted : old?.muted ?? false,
      volume: "volume" in payload ? payload.volume : old?.volume ?? 1,
    };
    if (e.type === "playback.rate_change")
      this.state = { ...old!, ...payload };
    else if (e.type === "playback.audio_change")
      this.state = { ...old!, ...payload, ...nextAudio };
    else
      this.state = {
        ...e.payload,
        ...nextAudio,
        paused:
          e.type === "playback.media_change"
            ? !!("paused" in e.payload && e.payload.paused)
            : e.type === "playback.play"
              ? false
              : e.type === "playback.pause"
                ? true
                : e.type === "playback.seek" && seekPaused !== undefined
                  ? seekPaused
                : sameMedia
                  ? old!.paused
                  : true,
        playbackRate: sameMedia ? old!.playbackRate : 1,
        updatedAt: 0,
        updatedBy: userId,
        stateSequence: 0,
      };
    if (e.type !== "playback.seek" && pendingSeekPosition !== undefined && "position" in e.payload)
      this.state!.position = pendingSeekPosition;
    const nextState = this.state!;
    nextState.updatedAt = this.now();
    nextState.updatedBy = userId;
    nextState.stateSequence = ++this.stateSequence;
    if (e.type === "playback.seek") {
      if (!this.pendingSeek) this.seekDue = this.now() + 50;
      this.pendingSeek = true;
    } else this.sync();
  }
  async tick() {
    await this.retryCleanup();
    if (this.ended) return;
    const now = this.now();
    for (const [u, p] of this.presence)
      if (p.socket && now - p.lastSeen >= 30000) {
        p.socket.close(4000, "Heartbeat timeout");
        await this.disconnect(u, p.connectionId!);
      }
    for (const [userId, p] of [...this.presence]) {
      if (p.socket || p.disconnectedAt === undefined || now - p.disconnectedAt < 30000) continue;
      const room = await this.store.room(this.id);
      const wasHost = room.hostUserId === userId;
      await this.store.close(this.id, userId, "DISCONNECTED_TIMEOUT");
      this.presence.delete(userId);
      this.send("room.member_left", { userId, reason: "DISCONNECTED_TIMEOUT" });
      await this.removeMedia(userId);
      if (wasHost) await this.transferOrEnd();
    }
    if (this.pendingSeek && now >= this.seekDue) this.flush();
  }
  private async removeMedia(userId: string) {
    this.cleanupPending.add(userId);
    try {
      await this.media.remove(this.id, userId);
      this.cleanupPending.delete(userId);
    } catch {
      this.nextCleanupAt = this.now() + 5000;
      log({ event: "livekit.remove_pending", roomId: this.id, userId });
    }
  }
  private async retryCleanup() {
    if (this.now() < this.nextCleanupAt) return;
    this.nextCleanupAt = this.now() + 5000;
    if (this.endCleanupPending) {
      try {
        await this.media.end(this.id);
        this.endCleanupPending = false;
        this.cleanupPending.clear();
      } catch {
        log({ event: "livekit.end_pending", roomId: this.id });
      }
    } else for (const uid of this.cleanupPending) await this.removeMedia(uid);
  }
  get disposable() {
    return this.ended && !this.endCleanupPending;
  }
  async end(reason: "HOST_ENDED" | "EMPTY_TIMEOUT") {
    if (this.ended) return;
    await this.store.end(this.id);
    this.ended = true;
    this.send("room.ended", {
      reason,
      endedAt: new Date(this.now()).toISOString(),
    });
    for (const p of this.presence.values()) p.socket?.close(4004, "Room ended");
    this.presence.clear();
    this.state = null;
    this.pendingSeek = false;
    this.endCleanupPending = true;
    this.nextCleanupAt = 0;
    await this.retryCleanup();
  }
}
export class Coordinators {
  private values = new Map<string, MemoryRoomCoordinator>();
  private tail: Promise<unknown> = Promise.resolve();
  constructor(
    private store: Store,
    private media: MediaService,
    private now = () => Date.now(),
  ) {}
  // ponytail: one local process serializes room mutations; use per-room queues if throughput requires it.
  run<T>(id: string, fn: (c: RoomCoordinator) => Promise<T>): Promise<T> {
    const work = this.tail.then(async () => {
      let c = this.values.get(id);
      if (!c) {
        const room = await this.store.room(id);
        if (room.status === "ENDED") throw new DomainError("ROOM_ENDED", 409);
        c = new MemoryRoomCoordinator(id, this.store, this.media, this.now);
        await c.recover();
        this.values.set(id, c);
      }
      return fn(c);
    });
    this.tail = work.catch(() => {});
    return work;
  }
  async recover() {
    for (const r of await this.store.db
      .select()
      .from(rooms)
      .where(eq(rooms.status, "ACTIVE")))
      await this.run(r.id, async () => {});
  }
  async tick() {
    for (const [id, coord] of this.values) {
      try {
        await this.run(id, (c) => c.tick());
        if (coord.disposable) this.values.delete(id);
      } catch {
        log({ event: "coordinator.cleanup_failed", roomId: id });
      }
    }
  }
}
