import { Hono } from "hono";
import { cors } from "hono/cors";
import { bodyLimit } from "hono/body-limit";
import { createNodeWebSocket } from "@hono/node-ws";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { Auth } from "../../../packages/auth/src/index.js";
import type { Config } from "../../../packages/config/src/index.js";
import type { Database } from "../../../packages/db/src/index.js";
import {
  memberships,
  rooms,
  user,
} from "../../../packages/db/src/schema.js";
import * as protocol from "../../../packages/protocol/src/index.js";
import {
  DomainError,
  MemoryRateLimiter,
  newId,
  log,
} from "../../../packages/shared/src/index.js";
import { Store } from "./store.js";
import { Coordinators } from "./coordinator.js";
import { Invites } from "./invites.js";
import type { MediaService } from "./livekit.js";
type Variables = { userId: string; requestId: string; clientIp: string };
export async function createApp(deps: {
  db: Database;
  auth: Auth;
  config: Config;
  media: MediaService;
  smtpHealth?: () => Promise<unknown>;
  now?: () => number;
}) {
  const { db, auth, config, media } = deps;
  const now = deps.now ?? (() => Date.now());
  const store = new Store(db);
  const coordinators = new Coordinators(store, media, now);
  await coordinators.recover();
  const invites = new Invites(config.INVITE_SECRET, config.APP_URL);
  const rates = new MemoryRateLimiter(now);
  const tickets = new Map<
    string,
    { roomId: string; userId: string; expires: number }
  >();
  const app = new Hono<{ Variables: Variables }>();
  const { injectWebSocket, upgradeWebSocket, wss } = createNodeWebSocket({
    app,
  });
  wss.options.maxPayload = 16384;
  const limited = (key: string, count: number, window: number) => {
    if (!rates.take(key, count, window))
      throw new DomainError("RATE_LIMITED", 429);
  };
  app.use("*", async (c, next) => {
    c.set("requestId", newId());
    const env = c.env as
      | { incoming?: { socket?: { remoteAddress?: string } } }
      | undefined;
    c.set("clientIp", env?.incoming?.socket?.remoteAddress ?? "local");
    c.header("X-Request-Id", c.get("requestId"));
    c.header("Cache-Control", "no-store");
    await next();
    log({
      event: "request",
      requestId: c.get("requestId"),
      method: c.req.method,
      status: c.res.status,
    });
  });
  app.use(
    "*",
    bodyLimit({
      maxSize: 16384,
      onError: () => {
        throw new DomainError("VALIDATION_ERROR", 400);
      },
    }),
  );
  app.use(
    "*",
    cors({
      origin: config.TRUSTED_ORIGINS.split(",").map((s) => s.trim()),
      allowHeaders: ["Content-Type", "Authorization"],
      exposeHeaders: ["set-auth-token", "X-Request-Id"],
      credentials: true,
    }),
  );
  app.onError((e, c) => {
    const error =
      e instanceof DomainError
        ? e
        : e instanceof z.ZodError || e instanceof SyntaxError
          ? new DomainError("VALIDATION_ERROR", 400)
          : new DomainError("INTERNAL_ERROR", 500);
    return c.json(
      {
        error: {
          code: error.code,
          message: error.code,
          requestId: c.get("requestId"),
          details: null,
        },
      },
      error.status as 400,
    );
  });
  app.get("/healthz", async (c) => {
    await db.select().from(rooms).limit(1);
    return c.json({ status: "ok" });
  });
  app.get("/readyz", async (c) => {
    try {
      await Promise.all([db.select().from(rooms).limit(1),media.health(), deps.smtpHealth?.()]);
      return c.json({ status: "ok" });
    } catch {
      return c.json({ status: "unavailable" }, 503);
    }
  });
  app.get("/join", (c) => c.html(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Join Syncron party</title><style>:root{color-scheme:light;--canvas:#fff;--surface:#fff;--text:#404040;--strong:#0a0a0a;--muted:#737373;--border:#e5e5e5;--brand:#1e90ff;--brand-light:#5cb3ff;--radius:8px;--space-4:16px;--space-6:24px;--font:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif}@media(prefers-color-scheme:dark){:root{color-scheme:dark;--canvas:#0a0a0a;--surface:#171717;--text:#d4d4d4;--strong:#fff;--muted:#a3a3a3;--border:#404040}}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--canvas);color:var(--text);font:14px/20px var(--font)}main{max-width:420px;margin:var(--space-4);padding:32px var(--space-6);border:1px solid color-mix(in srgb,var(--border) 90%,transparent);border-radius:18px;background:var(--surface);box-shadow:0 1px 3px rgb(0 0 0 / 10%),0 1px 2px -1px rgb(0 0 0 / 10%)}h1{margin:0 0 var(--space-4);color:var(--strong);font-size:24px;line-height:32px}p{margin:0;color:var(--muted)}</style><main><h1>Open this link in Syncron</h1><p>Install the Syncron extension, then reopen this invite link.</p></main>`));
  app.on(["GET", "POST"], "/api/auth/*", async (c) => {
    const headers = new Headers(c.req.raw.headers);
    headers.set("x-syncron-client-ip", c.get("clientIp"));
    limited(`auth:${c.get("clientIp")}`, 100, 60000);
    return auth.handler(new Request(c.req.raw, { headers }));
  });
  app.use("/api/v1/*", async (c, next) => {
    if (c.req.path.endsWith("/ws")) return next();
    if (!c.req.header("Authorization")?.startsWith("Bearer "))
      throw new DomainError("UNAUTHENTICATED", 401);
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session?.user.emailVerified)
      throw new DomainError("UNAUTHENTICATED", 401);
    c.set("userId", session.user.id);
    await next();
  });
  const me = async (id: string) => {
    const u = await db.query.user.findFirst({ where: eq(user.id, id) });
    return {
      ...(await store.publicUser(id)),
      email: u!.email,
      emailVerified: u!.emailVerified,
      createdAt: u!.createdAt.toISOString(),
      onboardingCompletedAt: (await store.profile(id))?.onboardingCompletedAt?.toISOString() ?? null,
    };
  };
  app.get("/api/v1/me", async (c) =>
    c.json({ user: await me(c.get("userId")) }),
  );
  app.patch("/api/v1/me", async (c) => {
    const body = protocol.profileUpdate.parse(await c.req.json());
    const id = c.get("userId");
    await store.updateProfile(id, body);
    return c.json({ user: await me(id) });
  });
  app.post("/api/v1/me/onboarding", async (c) => {
    const body = protocol.onboarding.parse(await c.req.json());
    const id = c.get("userId");
    await store.completeOnboarding(id, body);
    return c.json(await me(id));
  });
  app.get("/api/v1/users/:userId", async (c) =>
    c.json({
      user: await store.publicUser(protocol.id.parse(c.req.param("userId"))),
    }),
  );
  app.post("/api/v1/rooms", async (c) => {
    const body = protocol.createRoom.parse(await c.req.json());
    const uid = c.get("userId");
    if (!(await store.onboarded(uid))) throw new DomainError("ONBOARDING_REQUIRED", 409);
    limited(`create:${uid}`, 10, 3600000);
    const id = await store.create(uid, body.name, { everyoneCanControl: body.everyoneCanControl, media: body.media });
    await coordinators.run(id, async (coord) => coord.initializeMedia(body.media, uid));
    const navigation = await coordinators.run(id, (coord) => coord.navigation());
    return c.json(
      { room: await store.dto(id, navigation), inviteUrl: await invites.issue(id, 1) },
      201,
    );
  });
  const join = async (
    invite: string,
    uid: string,
    ip: string,
    expected?: string,
  ) => {
    if (!(await store.onboarded(uid))) throw new DomainError("ONBOARDING_REQUIRED", 409);
    limited(`join:user:${uid}`, 30, 600000);
    limited(`join:ip:${ip}`, 30, 600000);
    const claim = await invites.verify(invite);
    if (expected && claim.roomId !== expected)
      throw new DomainError("INVITE_INVALID");
    return coordinators.run(claim.roomId, async (coord) => {
      const r = await store.room(claim.roomId);
      if (claim.inviteVersion !== r.inviteVersion)
        throw new DomainError("INVITE_INVALID");
      const membership = await coord.join(uid);
      const navigation = await coord.navigation();
      return { room: await store.dto(r.id, navigation), membership };
    });
  };
  app.post("/api/v1/rooms/join", async (c) =>
    c.json(
      await join(
        protocol.joinRoom.parse(await c.req.json()).invite,
        c.get("userId"),
        c.get("clientIp"),
      ),
    ),
  );
  app.use("/api/v1/rooms/:roomId/*", async (c, next) => {
    protocol.roomId.parse(c.req.param("roomId"));
    await next();
  });
  app.get("/api/v1/rooms/:roomId", async (c) => {
    const id = protocol.roomId.parse(c.req.param("roomId"));
    if (
      !(
        await db
          .select()
          .from(memberships)
          .where(
            and(
              eq(memberships.roomId, id),
              eq(memberships.userId, c.get("userId")),
            ),
          )
          .limit(1)
      ).length
    )
      throw new DomainError("NOT_ROOM_MEMBER");
    return c.json({ room: await store.dto(id, await coordinators.run(id, (coord) => coord.navigation())) });
  });
  app.post("/api/v1/rooms/:roomId/join", async (c) =>
    c.json(
      await join(
        protocol.joinRoom.parse(await c.req.json()).invite,
        c.get("userId"),
        c.get("clientIp"),
        c.req.param("roomId"),
      ),
    ),
  );
  for (const rotate of [false, true])
    app.on(
      rotate ? "POST" : "GET",
      `/api/v1/rooms/:roomId/invite${rotate ? "/rotate" : ""}`,
      async (c) => {
        if (rotate) protocol.empty.parse(await c.req.json());
        const id = c.req.param("roomId")!;
        const uid = c.get("userId");
        limited(`host:${uid}`, 30, 60000);
        return c.json(
          await coordinators.run(id, async (coord) => {
            await coord.authorize(uid, true);
            let r = await store.room(id);
            if (rotate) {
              await db
                .update(rooms)
                .set({
                  inviteVersion: r.inviteVersion + 1,
                  updatedAt: new Date(),
                })
                .where(eq(rooms.id, id));
              r = await store.room(id);
            }
            return { inviteUrl: await invites.issue(id, r.inviteVersion) };
          }),
        );
      },
    );
  app.get("/api/v1/rooms/:roomId/members", async (c) =>
    c.json(
      await coordinators.run(c.req.param("roomId"), async (coord) => {
        await coord.authorize(c.get("userId"));
        return { members: await coord.members() };
      }),
    ),
  );
  app.patch("/api/v1/rooms/:roomId/settings", async (c) => {
    const body = protocol.settings.parse(await c.req.json());
    const uid = c.get("userId");
    limited(`host:${uid}`, 30, 60000);
    const id = c.req.param("roomId");
    await coordinators.run(id, async (coord) => {
      await coord.authorize(uid, true);
      await coord.settings(body.everyoneCanControl);
    });
    return c.json({ room: await store.dto(id) });
  });
  for (const action of ["leave", "end", "kick", "transfer-host"] as const)
    app.post(`/api/v1/rooms/:roomId/${action}`, async (c) => {
      const raw = await c.req.json();
      const target =
        action === "kick" || action === "transfer-host"
          ? protocol.targetUser.parse(raw).userId
          : undefined;
      if (!target) protocol.empty.parse(raw);
      const uid = c.get("userId");
      if (action !== "leave") limited(`host:${uid}`, 30, 60000);
      const id = c.req.param("roomId")!;
      await coordinators.run(id, async (coord) => {
        await coord.authorize(uid, action !== "leave");
        if (action === "end") await coord.end("HOST_ENDED");
        else if (action === "transfer-host") await coord.transfer(target!);
        else {
          if (action === "kick" && target === uid)
            throw new DomainError("CANNOT_KICK_SELF");
          if (target && !(await store.member(id, target)))
            throw new DomainError("TARGET_NOT_IN_ROOM", 409);
          await coord.leave(target ?? uid, action === "kick");
        }
      });
      return action === "transfer-host"
        ? c.json({ host: await store.publicUser(target!) })
        : c.body(null, 204);
    });
  app.post("/api/v1/rooms/:roomId/livekit-token", async (c) => {
    protocol.empty.parse(await c.req.json());
    const id = c.req.param("roomId");
    const uid = c.get("userId");
    limited(`livekit:${uid}:${id}`, 10, 60000);
    return c.json(
      await coordinators.run(id, async (coord) => {
        await coord.authorize(uid);
        try {
          const membership = await store.member(id, uid);
          return await media.token(id, uid, membership?.microphoneAllowed ?? true);
        } catch {
          throw new DomainError("LIVEKIT_TOKEN_UNAVAILABLE", 503);
        }
      }),
    );
  });
  app.patch("/api/v1/rooms/:roomId/members/:userId/microphone", async (c) => {
    const body = protocol.microphonePermission.parse(await c.req.json());
    const id = c.req.param("roomId");
    const target = c.req.param("userId");
    const uid = c.get("userId");
    limited(`host:${uid}`, 30, 60000);
    await coordinators.run(id, async (coord) => {
      await coord.authorize(uid, true);
      if (!(await store.member(id, target))) throw new DomainError("TARGET_NOT_IN_ROOM", 409);
      try { await media.microphone(id, target, body.allowed); }
      catch { throw new DomainError("LIVEKIT_MODERATION_PENDING", 503); }
      await coord.setMicrophoneAllowed(target, body.allowed);
    });
    return c.json({ allowed: body.allowed });
  });
  app.post("/api/v1/rooms/:roomId/ws-ticket", async (c) => {
    protocol.empty.parse(await c.req.json());
    const id = c.req.param("roomId");
    const uid = c.get("userId");
    limited(`ticket:${uid}`, 30, 60000);
    await coordinators.run(id, (coord) => coord.authorize(uid));
    for (const [t, v] of tickets) if (v.expires <= now()) tickets.delete(t);
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const ticket = Array.from(bytes, (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    const expires = now() + 30000;
    tickets.set(ticket, { roomId: id, userId: uid, expires });
    return c.json({ ticket, expiresAt: new Date(expires).toISOString() });
  });
  app.get(
    "/api/v1/rooms/:roomId/ws",
    async (c, next) => {
      const token = z
        .string()
        .regex(/^[a-f0-9]{64}$/)
        .safeParse(c.req.query("ticket"));
      if (!token.success) throw new DomainError("UNAUTHENTICATED", 401);
      const t = tickets.get(token.data);
      tickets.delete(token.data);
      if (!t || t.expires <= now() || t.roomId !== c.req.param("roomId"))
        throw new DomainError("UNAUTHENTICATED", 401);
      await coordinators.run(t.roomId, (coord) => coord.authorize(t.userId));
      c.set("userId", t.userId);
      await next();
    },
    upgradeWebSocket((c) => {
      const id = c.req.param("roomId")!;
      const uid = c.get("userId");
      let connectionId = "";
      const frames=new MemoryRateLimiter(now);
      return {
        onOpen: (_e, ws) => {
          void coordinators
            .run(id, async (coord) => {
              connectionId = await coord.connect(uid, ws);
            })
            .catch(() => ws.close(4003, "Membership unavailable"));
        },
        onMessage: (e, ws) => {
          if(!frames.take('frames',120,1000,240)){ws.close(4008,'Frame rate exceeded');return;}
          if (typeof e.data !== "string" || e.data.length > 16384) {
            ws.close(1009, "Invalid message");
            return;
          }
          let input: unknown;
          try {
            input = JSON.parse(e.data);
          } catch {
            input = null;
          }
          void coordinators
            .run(id, (coord) => coord.receive(uid, connectionId, input))
            .catch(() => ws.close(4003, "Room unavailable"));
        },
        onClose: () => {
          void coordinators
            .run(id, (coord) => coord.disconnect(uid, connectionId))
            .catch(() => {});
        },
        onError: (_e,ws)=>ws.close(1011,'WebSocket error'),
      };
    }),
  );
  app.notFound((c) =>
    c.json(
      {
        error: {
          code: "NOT_FOUND",
          message: "Not found",
          requestId: c.get("requestId"),
          details: null,
        },
      },
      404,
    ),
  );
  let ticking = false;
  const timer = setInterval(() => {
    if (ticking) return;
    ticking = true;
    void coordinators.tick().finally(() => {
      ticking = false;
    });
  }, 50);
  timer.unref();
  return {
    app,
    injectWebSocket,
    coordinators,
    store,
    stop: () => {clearInterval(timer);for(const socket of wss.clients)socket.close(1001,'Server shutting down');},
  };
}
