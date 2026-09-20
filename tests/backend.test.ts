import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, expect, test, vi } from "vitest";
import { serve } from "@hono/node-server";
import { WebSocket } from "ws";
import { eq } from "drizzle-orm";
import { openDatabase } from "../packages/db/src/index.js";
import {
  user,
  profiles,
  verification,
  rooms,
  memberships,
} from "../packages/db/src/schema.js";
import { config } from "../packages/config/src/index.js";
import {
  createAuth,
  googleProfile,
  type Mail,
} from "../packages/auth/src/index.js";
import {
  MemoryRateLimiter,
  newId,
  redact,
} from "../packages/shared/src/index.js";
import { initialUsername } from "../packages/validation/src/index.js";
import { clientEvent } from "../packages/protocol/src/index.js";
import { createApp } from "../apps/api/src/app.js";
import { livekit } from "../apps/api/src/livekit.js";
import {
  MemoryRoomCoordinator,
  Coordinators,
  type Socket,
} from "../apps/api/src/coordinator.js";
import { Invites } from "../apps/api/src/invites.js";
const c = config({
  BETTER_AUTH_SECRET: "a".repeat(40),
  INVITE_SECRET: "b".repeat(40),
  LIVEKIT_API_KEY: "test",
  LIVEKIT_API_SECRET: "c".repeat(40),
  LIVEKIT_URL: "ws://localhost:7880",
  LIVEKIT_INTERNAL_URL: "http://localhost:7880",
});
const cleanup: Array<() => unknown | Promise<unknown>> = [];
afterEach(async () => {
  for (const f of cleanup.splice(0).reverse()) await f();
  vi.restoreAllMocks();
});
async function setup(overrides: Record<string, string> = {}) {
  vi.spyOn(console, "log").mockImplementation(() => {});
  const testConfig = config({
    ...Object.fromEntries(
      Object.entries(c)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => [key, String(value)]),
    ),
    ...overrides,
  });
  const dir = await mkdtemp(join(tmpdir(), "syncron-test-"));
  cleanup.push(() =>
    rm(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }),
  );
  const { db, client } = await openDatabase(
    pathToFileURL(join(dir, "test.db")).href,
  );
  cleanup.push(() => client.close());
  let now = Date.now();
  const mails: Mail[] = [];
  const auth = createAuth(
    db,
    testConfig,
    async (m) => {
      mails.push(m);
    },
    new MemoryRateLimiter(() => now),
  );
  const real = livekit(testConfig);
  const media = {
    ...real,
    remove: vi.fn(async () => {}),
    end: vi.fn(async () => {}),
    health: vi.fn(async () => {}),
  };
  const runtime = await createApp({
    db,
    auth,
    config: testConfig,
    media,
    now: () => now,
  });
  cleanup.push(runtime.stop);
  const request = (
    path: string,
    body?: unknown,
    token?: string,
    method = body === undefined ? "GET" : "POST",
    origin?: string,
  ) =>
    runtime.app.request(path, {
      method,
      headers: {
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(origin ? { origin } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const seed = async (label = "alice") => {
    const id = newId();
    const date = new Date();
    await db
      .insert(user)
      .values({
        id,
        email: `${id}@example.com`,
        name: label,
        emailVerified: true,
        createdAt: date,
        updatedAt: date,
      });
    await db
      .insert(profiles)
      .values({
        userId: id,
        username: label,
        avatarId: "1",
        onboardingCompletedAt: date,
        createdAt: date,
        updatedAt: date,
      });
    return id;
  };
  const signup = async (email = "alice@example.com") => {
    const response = await request("/api/auth/sign-up/email", {
      email,
      password: "correct-horse-battery-123",
      name: "Alice",
    });
    expect(response.status).toBe(200);
    return { email, password: "correct-horse-battery-123" };
  };
  const login = async (email = "alice@example.com") => {
    const credentials = await signup(email);
    const otp = mails.at(-1)!.otp;
    expect(
      (await request("/api/auth/email-otp/verify-email", { email, otp }))
        .status,
    ).toBe(200);
    const r = await request("/api/auth/sign-in/email", credentials);
    expect(r.status).toBe(200);
    const body = await r.json();
    await request("/api/v1/me/onboarding", { username: email.split("@")[0], avatarId: "1" }, body.token as string);
    return { token: body.token as string, id: body.user.id as string };
  };
  return {
    ...runtime,
    db,
    media,
    auth,
    mails,
    request,
    seed,
    signup,
    login,
    advance: (ms: number) => {
      now += ms;
    },
    now: () => now,
  };
}

test("development allows extension CORS origins while production restricts them", async () => {
  const origin = "chrome-extension://development-extension";
  const production = await setup();
  expect(
    (await production.request("/healthz", undefined, undefined, "OPTIONS", origin)).headers.get(
      "access-control-allow-origin",
    ),
  ).toBeNull();

  const development = await setup({ NODE_ENV: "development" });
  expect(
    (await development.request("/healthz", undefined, undefined, "OPTIONS", origin)).headers.get(
      "access-control-allow-origin",
    ),
  ).toBe(origin);
});

test("GET /join always keeps the install-the-extension fallback, and only embeds a real extension ID when configured", async () => {
  const withoutId = await setup();
  const withoutIdHtml = await (await withoutId.request("/join")).text();
  expect(withoutIdHtml).toContain("Install or enable the Syncron extension");
  expect(withoutIdHtml).toContain('var EXTENSION_ID = "";');

  const withId = await setup({ EXTENSION_ID: "abcdefghijklmnopabcdefghijklmnop" });
  const withIdHtml = await (await withId.request("/join")).text();
  expect(withIdHtml).toContain("Install or enable the Syncron extension");
  expect(withIdHtml).toContain('var EXTENSION_ID = "abcdefghijklmnopabcdefghijklmnop";');
  expect(withIdHtml).toContain("syncron:preview-invite");
  expect(withIdHtml).toContain("history.replaceState");
  expect(withIdHtml).toContain("location.replace(response.destination)");
});

const playback = {
  provider: "YOUTUBE",
  mediaId: "abc",
  url: "https://youtube.com/watch?v=abc",
  position: 10,
};
const roomMedia = {
  provider: "YOUTUBE",
  mediaId: "abc",
  url: "https://youtube.com/watch?v=abc",
} as const;
const event = (type: string, payload: unknown, sequence = 1) => ({
  type,
  payload,
  sequence,
  requestId: "request",
  sentAt: Date.now(),
});
function socket() {
  const events: Array<{
    type: string;
    serverSequence: number;
    payload: Record<string, unknown>;
  }> = [];
  const s: Socket = {
    send: (data) => events.push(JSON.parse(data)),
    close: vi.fn(),
  };
  return { ...s, events };
}

test("clean migrations enforce identity, capacity and active intervals without chat/playback persistence", async () => {
  const s = await setup();
  const a = await s.seed(),
    b = await s.seed();
  expect(a).toMatch(/^[\da-f-]{14}7/);
  const id = await s.store.create(a);
  await s.store.join(id, b, a);
  expect(await s.db.select().from(profiles)).toHaveLength(2);
  expect(() =>
    s.db
      .insert(memberships)
      .values({
        id: newId(),
        roomId: id,
        userId: b,
        role: "MEMBER",
        joinedAt: new Date(),
      })
      .run(),
  ).toThrow();
  expect(() =>
    s.db
      .update(rooms)
      .set({ maxParticipants: 26 })
      .where(eq(rooms.id, id))
      .run(),
  ).toThrow();
  const tables = await s.db.all<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table'",
  );
  expect(tables.map((t) => t.name)).not.toContain("chat_messages");
  expect(tables.map((t) => t.name)).not.toContain("playback_state");
  const columns=s.db.all<{name:string}>("PRAGMA table_info(rooms)").map(r=>r.name);
  for(const removed of ['code','password_hash','access_mode'])expect(columns).not.toContain(removed);
  expect(()=>s.db.insert(memberships).values({id:newId(),roomId:id,userId:'missing',role:'MEMBER',joinedAt:new Date()}).run()).toThrow();
});

test("OTP verification is numeric, hashed, required, single-use and rotating with cooldown", async () => {
  const s = await setup();
  const credentials = await s.signup();
  const first = s.mails[0]!.otp;
  expect(first).toMatch(/^\d{6}$/);
  const rows = await s.db.select().from(verification);
  expect(rows.some((r) => r.value.includes(first))).toBe(false);
  expect(
    rows.some(
      (r) => Math.abs(r.expiresAt.getTime() - Date.now() - 300000) < 5000,
    ),
  ).toBe(true);
  expect((await s.request("/api/auth/sign-in/email", credentials)).status).toBe(
    403,
  );
  expect(
    (
      await s.request("/api/auth/email-otp/send-verification-otp", {
        email: credentials.email,
        type: "email-verification",
      })
    ).status,
  ).toBe(429);
  s.advance(60001);
  expect(
    (
      await s.request("/api/auth/email-otp/send-verification-otp", {
        email: credentials.email,
        type: "email-verification",
      })
    ).status,
  ).toBe(200);
  const otp = s.mails.at(-1)!.otp;
  expect(otp).not.toBe(first);
  expect(
    (
      await s.request("/api/auth/email-otp/verify-email", {
        email: credentials.email,
        otp: first,
      })
    ).status,
  ).not.toBe(200);
  expect(
    (
      await s.request("/api/auth/email-otp/verify-email", {
        email: credentials.email,
        otp,
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await s.request("/api/auth/email-otp/verify-email", {
        email: credentials.email,
        otp,
      })
    ).status,
  ).not.toBe(200);
});

test("OTP exhaustion and expiry prevent verification; Google requires verified claim", async () => {
  const s = await setup();
  await s.signup();
  const otp = s.mails[0]!.otp;
  for (let i = 0; i < 3; i++)
    expect(
      (
        await s.request("/api/auth/email-otp/verify-email", {
          email: "alice@example.com",
          otp: otp === "000000" ? "111111" : "000000",
        })
      ).status,
    ).not.toBe(200);
  expect(
    (
      await s.request("/api/auth/email-otp/verify-email", {
        email: "alice@example.com",
        otp,
      })
    ).status,
  ).not.toBe(200);
  await expect(s.auth.api.verifyEmailOTP({body:{email:'alice@example.com',otp}})).rejects.toMatchObject({body:{code:'INVALID_OTP'}});
  s.advance(61000);
  await s.request("/api/auth/email-otp/send-verification-otp", {
    email: "alice@example.com",
    type: "email-verification",
  });
  await s.db.update(verification).set({ expiresAt: new Date(0) });
  await expect(s.auth.api.verifyEmailOTP({body:{email:'alice@example.com',otp:s.mails.at(-1)!.otp}})).rejects.toMatchObject({body:{code:'OTP_EXPIRED'}});
  expect(
    (
      await s.request("/api/auth/email-otp/verify-email", {
        email: "alice@example.com",
        otp: s.mails.at(-1)!.otp,
      })
    ).status,
  ).not.toBe(200);
  expect(googleProfile({ email_verified: true })).toEqual({
    emailVerified: true,
  });
  expect(() => googleProfile({ email_verified: false })).toThrow();
  expect(() => googleProfile({})).toThrow();
});

test("recovery uses hashed six-digit OTP, resets password and revokes sessions", async () => {
  const s = await setup();
  const { token } = await s.login();
  s.advance(61000);
  expect(
    (
      await s.request("/api/auth/email-otp/request-password-reset", {
        email: "alice@example.com",
      })
    ).status,
  ).toBe(200);
  const otp = s.mails.at(-1)!.otp;
  expect(otp).toMatch(/^\d{6}$/);
  expect(
    (await s.db.select().from(verification)).some((r) => r.value.includes(otp)),
  ).toBe(false);
  expect(
    (
      await s.request("/api/auth/email-otp/reset-password", {
        email: "alice@example.com",
        otp,
        password: "new-password-12345",
      })
    ).status,
  ).toBe(200);
  expect((await s.request("/api/v1/me", undefined, token)).status).toBe(401);
  expect(
    (
      await s.request("/api/auth/sign-in/email", {
        email: "alice@example.com",
        password: "new-password-12345",
      })
    ).status,
  ).toBe(200);
});

test("REST auth, invite rotation, host checks, profile labels, LiveKit grants and ending", async () => {
  const s = await setup();
  const a = await s.login();
  s.advance(61000);
  const b = await s.login("alice@other.com");
  s.advance(61000);
  const c = await s.login("alice@third.com");
  expect((await s.request("/api/v1/me")).status).toBe(401);
  expect(
    (await s.request("/api/v1/me", { username: "alice" }, b.token, "PATCH"))
      .status,
  ).toBe(200);
  const created = await (
    await s.request("/api/v1/rooms", { name: "Movie", media: roomMedia }, a.token)
  ).json();
  const id = created.room.id;
  const previewResponse = await s.request(
    "/api/v1/rooms/preview",
    { invite: new URL(created.inviteUrl).hash.slice(8) },
    b.token,
  );
  expect(previewResponse.status).toBe(200);
  expect(await previewResponse.json()).toMatchObject({
    preview: {
      name: "Movie",
      title: "Movie",
      media: roomMedia,
      participantCount: 1,
      maxParticipants: 25,
      everyoneCanControl: true,
      allowMembersToShareInvite: false,
      host: { id: a.id },
    },
  });
  expect((await s.store.active(id)).length).toBe(1);
  expect(created.room.allowMembersToShareInvite).toBe(false);
  expect((await s.store.room(id)).allowMembersToShareInvite).toBe(false);
  const invite = new URL(created.inviteUrl).hash.slice(8);
  expect(
    (await s.request(`/api/v1/rooms/${id}/join`, {}, b.token)).status,
  ).toBe(400);
  expect(
    (await s.request("/api/v1/rooms/join", { invite }, b.token)).status,
  ).toBe(200);
  expect(
    (await s.request(`/api/v1/rooms/${id}/invite`, undefined, b.token)).status,
  ).toBe(403);
  const shared = await (
    await s.request(
      "/api/v1/rooms",
      { media: roomMedia, allowMembersToShareInvite: true },
      c.token,
    )
  ).json();
  expect(shared.room.allowMembersToShareInvite).toBe(true);
  expect((await s.store.room(shared.room.id)).allowMembersToShareInvite).toBe(true);
  const sharedInvite = new URL(shared.inviteUrl).hash.slice(8);
  expect(
    (await s.request("/api/v1/rooms/join", { invite: sharedInvite }, b.token))
      .status,
  ).toBe(200);
  expect(
    (await s.request(`/api/v1/rooms/${shared.room.id}/invite`, undefined, b.token))
      .status,
  ).toBe(200);
  expect(
    (await s.request(`/api/v1/rooms/${shared.room.id}/invite/rotate`, {}, b.token))
      .status,
  ).toBe(403);
  expect(
    (
      await s.request(
        `/api/v1/rooms/${id}/settings`,
        { everyoneCanControl: false },
        b.token,
        "PATCH",
      )
    ).status,
  ).toBe(403);
  const tokenResponse = await s.request(
    `/api/v1/rooms/${id}/livekit-token`,
    {},
    b.token,
  );
  expect(tokenResponse.status).toBe(200);
  const token = await tokenResponse.json();
  const jwt = JSON.parse(
    Buffer.from(token.token.split(".")[1], "base64url").toString(),
  );
  expect(jwt.sub).toBe(b.id);
  expect(jwt.exp - jwt.nbf).toBe(600);
  expect(jwt.video).toMatchObject({
    room: `sync_${id}`,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    canPublishSources: ["camera", "microphone"],
  });
  await s.request(`/api/v1/rooms/${id}/invite/rotate`, {}, a.token);
  expect(
    (await s.request("/api/v1/rooms/join", { invite }, b.token)).status,
  ).toBe(403);
  expect(
    (await s.request("/api/v1/rooms/preview", { invite }, b.token)).status,
  ).toBe(403);
  expect(
    (await s.request(`/api/v1/rooms/${id}/kick`, { userId: b.id }, a.token))
      .status,
  ).toBe(204);
  expect(s.media.remove).toHaveBeenCalledWith(id, b.id);
  expect(
    (await s.request(`/api/v1/rooms/${id}/livekit-token`, {}, b.token)).status,
  ).toBe(403);
  expect((await s.request(`/api/v1/rooms/${id}/end`, {}, a.token)).status).toBe(
    204,
  );
  expect(s.media.end).toHaveBeenCalledWith(id);
  expect(
    (await s.request(`/api/v1/rooms/${id}/livekit-token`, {}, a.token)).status,
  ).toBe(409);
  expect((await s.store.active(id)).length).toBe(0);
  expect(JSON.stringify(await s.db.select().from(rooms))).not.toContain(invite);
  expect(JSON.stringify(vi.mocked(console.log).mock.calls)).not.toContain(
    invite,
  );
});

test("invites reject tampering, wrong signatures and invalid claims", async () => {
  const invites = new Invites(c.INVITE_SECRET, c.APP_URL);
  const id = newId();
  const token = new URL(await invites.issue(id, 1)).hash.slice(8);
  expect(await invites.verify(token)).toEqual({ roomId: id, inviteVersion: 1 });
  await expect(invites.verify(token + "x")).rejects.toThrow("INVITE_INVALID");
  await expect(new Invites("wrong", c.APP_URL).verify(token)).rejects.toThrow();
  await expect(invites.verify("bad")).rejects.toThrow();
});

test("coordinator handles permissions, sequence, seek coalescing, socket replacement and failover", async () => {
  const s = await setup();
  const a = await s.seed("alice"),
    b = await s.seed("bobby");
  const id = await s.store.create(a);
  const coord = new MemoryRoomCoordinator(id, s.store, s.media, s.now);
  await coord.recover();
  await coord.join(b);
  const x = socket(),
    y = socket();
  const ca = await coord.connect(a, x),
    cb = await coord.connect(b, y);
  expect(y.events.some((e) => e.type === "playback.no_state")).toBe(true);
  await coord.receive(a, ca, event("playback.play", playback));
  await coord.receive(
    a,
    ca,
    event(
      "playback.media_change",
      {
        provider: "YOUTUBE",
        mediaId: "different-video",
        url: "https://youtube.com/watch?v=different-video",
        position: 0,
        paused: true,
        muted: false,
        volume: 1,
      },
      2,
    ),
  );
  expect(x.events.at(-1)?.type).toBe("playback.state");
  expect(x.events.at(-1)?.payload.url).toBe(playback.url);
  await coord.settings(false);
  await coord.receive(b, cb, event("playback.pause", playback));
  expect(y.events.at(-1)?.payload.code).toBe("PLAYBACK_CONTROL_FORBIDDEN");
  await coord.receive(
    a,
    ca,
    event("playback.seek", { ...playback, position: 20 }, 3),
  );
  await coord.receive(
    a,
    ca,
    event("playback.seek", { ...playback, position: 30 }, 4),
  );
  s.advance(51);
  await coord.tick();
  expect(y.events.at(-1)?.payload.position).toBe(30);
  await coord.receive(a, ca, event("playback.pause", playback, 3));
  expect(x.events.at(-1)?.payload.code).toBe("STALE_SEQUENCE");
  const replacement = socket();
  const ca2 = await coord.connect(a, replacement);
  await coord.disconnect(a, ca);
  expect((await coord.members()).find((m) => m.user.id === a)?.connected).toBe(
    true,
  );
  expect(replacement.events.some((e) => e.type === "playback.state")).toBe(
    true,
  );
  await coord.disconnect(a, ca2);
  s.advance(29000);
  await coord.receive(b, cb, event("client.ping", { clientTime: s.now() }, 2));
  s.advance(1001);
  await coord.tick();
  expect((await s.store.room(id)).hostUserId).toBe(b);
  expect(await s.store.member(id, a)).toBeDefined();
  const sequences = y.events.map((e) => e.serverSequence);
  expect(sequences.every((v, i) => !i || v > sequences[i - 1]!)).toBe(true);
});

test("initial playback and audio state are authoritative for joining clients", async () => {
  const s = await setup();
  const a = await s.seed("alice");
  const b = await s.seed("bobby");
  const id = await s.store.create(a, undefined, { media: roomMedia });
  const coord = new MemoryRoomCoordinator(id, s.store, s.media, s.now);
  await coord.initializeMedia(roomMedia, a, {
    position: 37.25,
    paused: true,
    playbackRate: 1.5,
    muted: true,
    volume: 0.25,
  });
  await coord.join(b);
  const client = socket();
  await coord.connect(b, client);
  expect(client.events.find((e) => e.type === "playback.state")?.payload).toMatchObject({
    position: 37.25,
    paused: true,
    playbackRate: 1.5,
    muted: true,
    volume: 0.25,
  });
  const host = socket();
  const hostConnection = await coord.connect(a, host);
  await coord.receive(
    a,
    hostConnection,
    event("playback.audio_change", {
      position: 38,
      muted: false,
      volume: 0.8,
    }),
  );
  expect(client.events.at(-1)?.payload).toMatchObject({ muted: false, volume: 0.8 });
});

test("capacity is 25 and concurrent coordinator joins cannot overbook", async () => {
  const s = await setup();
  const host = await s.seed();
  const id = await s.store.create(host);
  const users = await Promise.all(
    Array.from({ length: 25 }, (_, i) => s.seed(`u${i}`)),
  );
  const outcomes = await Promise.allSettled(
    users.map((u) => s.coordinators.run(id, (coord) => coord.join(u))),
  );
  expect(outcomes.filter((o) => o.status === "fulfilled")).toHaveLength(24);
  expect(await s.store.active(id)).toHaveLength(25);
  const first = (await s.store.member(id, host))!.id;
  await s.coordinators.run(id, (coord) => coord.join(host));
  expect((await s.store.member(id, host))!.id).toBe(first);
});

test("disconnects retain active memberships; restart loses playback without ending the room", async () => {
  const s = await setup();
  const a = await s.seed();
  const id = await s.store.create(a);
  const coord = new MemoryRoomCoordinator(id, s.store, s.media, s.now);
  await coord.recover();
  const x = socket();
  const cid = await coord.connect(a, x);
  await coord.receive(a, cid, event("playback.play", playback));
  await coord.disconnect(a, cid);
  s.advance(60000);
  await coord.tick();
  expect(await s.store.member(id, a)).toBeDefined();
  const y = socket();
  await coord.connect(a, y);
  expect(y.events.some((e) => e.type === "playback.state")).toBe(true);
  const restart = new Coordinators(s.store, s.media, s.now);
  await restart.recover();
  const z = socket();
  await restart.run(id, (c) => c.connect(a, z));
  expect(z.events.some((e) => e.type === "playback.no_state")).toBe(true);
  s.advance(600000);
  await restart.tick();
  expect((await s.store.room(id)).status).toBe("ACTIVE");
  expect(await s.store.member(id, a)).toBeDefined();
  await restart.run(id, (c) => c.join(a));
});

test("controls enforce finite payload bounds, heartbeat and burst rate", async () => {
  const s = await setup();
  expect(
    clientEvent.safeParse(event("playback.play", { ...playback, position: -1 }))
      .success,
  ).toBe(false);
  expect(
    clientEvent.safeParse(
      event("playback.rate_change", { position: 0, playbackRate: 4.1 }),
    ).success,
  ).toBe(false);
  expect(
    clientEvent.safeParse(
      event("playback.audio_change", { position: 0, muted: true, volume: 0.5 }),
    ).success,
  ).toBe(true);
  expect(
    clientEvent.safeParse(
      event("playback.audio_change", { position: 0, muted: true, volume: 1.1 }),
    ).success,
  ).toBe(false);
  expect(
    clientEvent.safeParse(
      event("playback.play", { ...playback, url: "javascript:alert(1)" }),
    ).success,
  ).toBe(false);
  const a = await s.seed();
  const id = await s.store.create(a);
  const coord = new MemoryRoomCoordinator(id, s.store, s.media, s.now);
  await coord.recover();
  const x = socket();
  const cid = await coord.connect(a, x);
  for (let i = 0; i < 61; i++)
    await coord.receive(a, cid, event("playback.play", playback, i));
  expect(x.events.at(-1)?.payload.code).toBe("RATE_LIMITED");
  s.advance(30000);
  await coord.tick();
  expect(x.close).toHaveBeenCalledWith(4000, "Heartbeat timeout");
  expect(
    redact({
      headers: { authorization: "secret" },
      invite: "raw",
      otp: "123456",
      roomId: id,
    }),
  ).toEqual({
    headers: { authorization: "[REDACTED]" },
    invite: "[REDACTED]",
    otp: "[REDACTED]",
    roomId: id,
  });
  expect(initialUsername("a@example.com", "Good Name")).toBe("good");
  expect(initialUsername("admin@example.com", "!")).toBe("user");
});

test("real WebSockets exchange state; tickets are scoped, expiring and single use", async () => {
  const s = await setup();
  const a = await s.login();
  s.advance(61000);
  const b = await s.login("bob@example.com");
  const created = await (
    await s.request(
      "/api/v1/rooms",
      {
        media: roomMedia,
        initialPlayback: {
          position: 12.5,
          paused: true,
          playbackRate: 1,
          muted: true,
          volume: 0.4,
        },
      },
      a.token,
    )
  ).json();
  const id = created.room.id;
  await s.request(
    "/api/v1/rooms/join",
    { invite: new URL(created.inviteUrl).hash.slice(8) },
    b.token,
  );
  const server = serve({ fetch: s.app.fetch, port: 0, hostname: "127.0.0.1" });
  s.injectWebSocket(server);
  cleanup.push(
    () => new Promise<void>((resolve) => server.close(() => resolve())),
  );
  await new Promise<void>((resolve) =>
    server.listening ? resolve() : server.once("listening", resolve),
  );
  const address = server.address();
  if (!address || typeof address === "string") throw new Error();
  const base = `ws://127.0.0.1:${address.port}/api/v1/rooms/${id}/ws?ticket=`;
  const ticket = async (token: string) =>
    (await (await s.request(`/api/v1/rooms/${id}/ws-ticket`, {}, token)).json())
      .ticket as string;
  const connect = async (t: string) => {
    const ws = new WebSocket(base + t);
    cleanup.push(() => ws.terminate());
    const messages: Array<{ type: string; payload: Record<string, unknown> }> =
      [];
    ws.on("message", (data) => messages.push(JSON.parse(data.toString())));
    await new Promise<void>((resolve, reject) => {
      ws.once("open", resolve);
      ws.once("error", reject);
    });
    return { ws, messages };
  };
  const t = await ticket(a.token);
  const x = await connect(t);
  const y = await connect(await ticket(b.token));
  await vi.waitFor(() =>
    expect(y.messages.some((m) => m.type === "playback.state")).toBe(true),
  );
  expect(y.messages.find((m) => m.type === "playback.state")?.payload).toMatchObject({
    position: 12.5,
    paused: true,
    muted: true,
    volume: 0.4,
  });
  x.ws.send(JSON.stringify(event("playback.play", playback)));
  await vi.waitFor(() =>
    expect(y.messages.some((m) => m.type === "playback.state")).toBe(true),
  );
  await expect(connect(t)).rejects.toThrow();
  const expired = await ticket(a.token);
  s.advance(30001);
  await expect(connect(expired)).rejects.toThrow();
});

test("sliding limits enforce the whole window and control buckets refill", () => {
  let now = 0;
  const limiter = new MemoryRateLimiter(() => now);
  expect(limiter.take("email", 3, 600000)).toBe(true);
  now = 61000;
  expect(limiter.take("email", 3, 600000)).toBe(true);
  now = 122000;
  expect(limiter.take("email", 3, 600000)).toBe(true);
  now = 599999;
  expect(limiter.take("email", 3, 600000)).toBe(false);
  now = 600000;
  expect(limiter.take("email", 3, 600000)).toBe(true);
  for (let i = 0; i < 60; i++)
    expect(limiter.take("ws", 30, 1000, 60)).toBe(true);
  expect(limiter.take("ws", 30, 1000, 60)).toBe(false);
  now += 1000;
  for (let i = 0; i < 30; i++)
    expect(limiter.take("ws", 30, 1000, 60)).toBe(true);
  expect(limiter.take("ws", 30, 1000, 60)).toBe(false);
});

test("configuration rejects partial SMTP, OAuth and weak/shared secrets", () => {
  const env = {
    BETTER_AUTH_SECRET: c.BETTER_AUTH_SECRET,
    INVITE_SECRET: c.INVITE_SECRET,
    LIVEKIT_API_KEY: c.LIVEKIT_API_KEY,
    LIVEKIT_API_SECRET: c.LIVEKIT_API_SECRET,
    LIVEKIT_URL: c.LIVEKIT_URL,
    LIVEKIT_INTERNAL_URL: c.LIVEKIT_INTERNAL_URL,
  };
  expect(() => config({ ...env, GMAIL_HOST: "smtp.gmail.com" })).toThrow();
  expect(() => config({ ...env, SMTP_HOST: "mailpit" })).toThrow();
  expect(() => config({ ...env, GOOGLE_CLIENT_ID: "id" })).toThrow();
  expect(() =>
    config({ ...env, INVITE_SECRET: env.BETTER_AUTH_SECRET }),
  ).toThrow();
  expect(() => config({ ...env, BETTER_AUTH_SECRET: "short" })).toThrow();
  expect(config({ ...env, NODE_ENV: "development" }).NODE_ENV).toBe("development");
  expect(
    config({
      ...env,
      GMAIL_HOST: "smtp.gmail.com",
      GMAIL_PORT: "587",
      GMAIL_USERNAME: "user",
      GMAIL_APP_PASSWORD: "app-password",
      GMAIL_SENDER: "user@example.com",
    }).GMAIL_PORT,
  ).toBe(587);
});

test("host transfer, explicit leave and cleanup retry preserve authoritative membership", async () => {
  const s = await setup();
  const a = await s.seed("alice"),
    b = await s.seed("bobby");
  const id = await s.store.create(a);
  const coord = new MemoryRoomCoordinator(id, s.store, s.media, s.now);
  await coord.recover();
  await coord.join(b);
  await coord.connect(a, socket());
  await coord.connect(b, socket());
  await coord.transfer(b);
  expect((await s.store.room(id)).hostUserId).toBe(b);
  await coord.leave(b);
  expect((await s.store.room(id)).hostUserId).toBe(a);
  expect(await s.store.member(id, b)).toBeUndefined();
  await coord.join(b);
  s.media.remove.mockRejectedValueOnce(new Error("offline"));
  await coord.leave(b, true);
  await expect(coord.join(b)).rejects.toThrow("LIVEKIT_TOKEN_UNAVAILABLE");
  s.advance(5001);
  await coord.tick();
  await coord.join(b);
  s.media.end.mockRejectedValueOnce(new Error("offline"));
  await coord.end("HOST_ENDED");
  expect(coord.disposable).toBe(false);
  expect(await s.store.active(id)).toHaveLength(0);
  s.advance(5001);
  await coord.tick();
  expect(coord.disposable).toBe(true);
});

test("wrong-room invites, nonmember tokens, request validation and OTP send quota", async () => {
  const s = await setup();
  const a = await s.login();
  s.advance(61000);
  const b = await s.login("bob@example.com");
  const one = await (await s.request("/api/v1/rooms", { media: roomMedia }, a.token)).json();
  const repeated = await s.request("/api/v1/rooms", { media: roomMedia }, a.token);
  expect(repeated.status).toBe(200);
  expect((await repeated.json()).room.id).toBe(one.room.id);
  const two = await (await s.request("/api/v1/rooms", { media: roomMedia }, b.token)).json();
  const invite = new URL(one.inviteUrl).hash.slice(8);
  expect(
    (await s.request(`/api/v1/rooms/${two.room.id}/join`, { invite }, b.token))
      .status,
  ).toBe(403);
  expect(
    (await s.request(`/api/v1/rooms/${one.room.id}/livekit-token`, {}, b.token))
      .status,
  ).toBe(403);
  expect(
    (await s.request("/api/v1/rooms", { maxParticipants: 100 }, a.token))
      .status,
  ).toBe(400);
  expect(
    (await s.request("/api/v1/me", { username: "admin" }, a.token, "PATCH"))
      .status,
  ).toBe(400);
  expect(
    (
      await s.request(
        `/api/v1/rooms/${one.room.id}/kick`,
        { userId: a.id },
        a.token,
      )
    ).status,
  ).toBe(403);
  s.advance(61000);
  expect(
    (
      await s.request("/api/auth/email-otp/request-password-reset", {
        email: "alice@example.com",
      })
    ).status,
  ).toBe(200);
  s.advance(61000);
  expect(
    (
      await s.request("/api/auth/email-otp/request-password-reset", {
        email: "alice@example.com",
      })
    ).status,
  ).toBe(429);
});
