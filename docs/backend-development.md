# Backend development

This milestone implements the local backend only. The extension, media adapters and frontend are deferred. The later YouTube fullscreen layout must reserve 80% for video and 20% for the persistent sidebar. Generic fullscreen containers support the layout only when they accept injected children; connections remain active otherwise.

Use Node 24 and pnpm 11.19.0. Install with `pnpm install`. Copy `.env.example` to `.env` and replace all three secret placeholders with distinct random values. Each secret needs at least 32 characters. `.env` is ignored by Git and Docker builds.

```sh
pnpm migrate
pnpm dev
pnpm test
pnpm typecheck
pnpm lint
```

The API defaults to port 3001. `pnpm start` runs without watching. The development/start/migration commands load `.env` when present. SQLite is created from committed Drizzle migrations on API startup and by `pnpm migrate`; running either repeatedly is safe. Generate future migrations with `pnpm db:generate`. Never edit an already deployed migration.

## Environment

| Variable | Default / purpose |
|---|---|
| `API_PORT` | 3001 |
| `DATABASE_URL` | `file:./data/syncron.db`; SQLite path or file URL |
| `APP_URL` | `http://localhost:3001`; future invite landing origin |
| `BETTER_AUTH_URL` | `http://localhost:3001`; API auth origin |
| `BETTER_AUTH_SECRET` | required random session/auth secret |
| `INVITE_SECRET` | required separate random HMAC secret |
| `TRUSTED_ORIGINS` | comma-separated explicit origins, defaults to `http://localhost:3001` |
| `LIVEKIT_URL` | required browser-facing ws/wss URL |
| `LIVEKIT_INTERNAL_URL` | required server-facing http(s)/ws(s) URL |
| `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | both required; secret at least 32 characters |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | both optional; partial configuration fails startup |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SENDER` | `localhost`, 1025, `syncron@localhost.test`; Mailpit defaults |
| `GMAIL_HOST`, `GMAIL_PORT`, `GMAIL_USERNAME`, `GMAIL_APP_PASSWORD`, `GMAIL_SENDER` | all five switch to Gmail; partial configuration fails startup; TLS required |

Set Google's authorized callback URI to `<BETTER_AUTH_URL>/api/auth/callback/google`. Google sign-in is disabled when credentials are absent. The provider must assert a verified email; otherwise authentication fails. Do not use real Gmail credentials in tests. SMTP connectivity is reported by readiness; partial or invalid configuration fails immediately.

## Local infrastructure

Docker Compose 2.24.4+ is required for the isolated smoke-test override. `docker compose up -d --build` starts the API, LiveKit and Mailpit; `docker compose down` stops them while retaining the SQLite volume. Mailpit's inbox is at `http://localhost:8025`. For an API running on the host, use `docker compose up -d livekit mailpit`, then `pnpm dev`.

`GET /healthz` probes SQLite. `GET /readyz` probes SMTP and LiveKit management connectivity, returning 503 when either is unavailable. Compose uses readiness to gate the API's healthy status. LiveKit's management API is the authenticated health probe rather than a dependency on tools installed inside its image.

`pnpm docker:smoke` generates temporary secrets, builds an isolated `syncron-smoke` Compose project, waits for readiness, signs up a user, reads their OTP from Mailpit, verifies email, signs in, creates a room, validates LiveKit claims, ends the room and removes only its own project volumes in `finally`. Ports 3001, 7880–7882, 1025 and 8025 must be available. Docker is not installed in the implementation environment, so this command requires validation on a Docker host.

## Auth and realtime client flow

1. `POST /api/auth/sign-up/email` with `email`, `password`, `name`.
2. `POST /api/auth/email-otp/verify-email` with `email`, `otp`.
3. `POST /api/auth/sign-in/email`; use returned `token` as `Authorization: Bearer <token>`. The bearer plugin also exposes `set-auth-token` where applicable.
4. Create a room or extract an invite fragment, immediately remove it from the visible browser URL, and submit `{invite}` to `/api/v1/rooms/join`.
5. Obtain a room's `/ws-ticket` with `{}`; connect to `/ws?ticket=<ticket>`. It expires after 30 seconds and can be used once. Read `connection.ready` and `playback.state`/`playback.no_state` before sending controls.
6. Send `client.ping` every 15 seconds. Client sequences start at 0 or above and increase per socket. Playback control bursts permit 60 events, refilling at 30/sec. Server and state sequences are scoped to the current coordinator and restart after API restart; reset the client's sequence baseline on `connection.ready`.

Recovery: `POST /api/auth/email-otp/request-password-reset` with `email`, then `/api/auth/email-otp/reset-password` with `email`, `otp`, `password`. Password reset revokes existing sessions. OTP-only sign-in and Better Auth's direct profile update route are disabled; use Syncron's validated `PATCH /api/v1/me`. Email changes and account deletion remain deferred.

## Local limits and lifetime

| Action | Limit |
|---|---|
| OTP send | 3 / 10 minutes per normalized email and socket IP; 60-second email cooldown |
| Room creation | 10 / hour per user |
| Join attempt | 30 / 10 minutes per user and socket IP |
| Host actions | 30 / minute per user |
| LiveKit token | 10 / minute per user/room |
| WebSocket ticket | 30 / minute per user |
| Auth requests | 100 / minute per socket IP plus Better Auth limits |
| WebSocket events | sustained 30/sec, burst 60 |

REST uses sliding windows; WebSocket events use token buckets. Forwarded IP headers are deliberately ignored in this direct local-server topology. A trusted reverse-proxy policy and distributed rate-limit adapter are needed before scaling out.

Memberships reserve capacity during a 30-second reconnect grace. When nobody is connected, memberships and playback survive for five minutes instead. Restart restores active memberships with a fresh five-minute window and no playback state. Host failover selects the earliest currently connected user, with user ID as the tie-break. One local mutation queue serializes coordinator changes; the `RoomCoordinator` interface is the boundary for a future Durable Object implementation.

LiveKit cleanup failures are logged using IDs only and retried while this process runs. Ending still irreversibly denies API access and closes playback sockets. A previously issued LiveKit JWT can remain valid until its ten-minute expiry; production deployment must account for SFU token revocation and cleanup across process failures. No playback, chat, invite tokens, microphone or camera data is persisted. SQLite retains historical rooms/memberships.

Implementation references: [Better Auth email OTP](https://better-auth.com/docs/plugins/email-otp), [Drizzle adapter](https://better-auth.com/docs/adapters/drizzle), [LiveKit release](https://github.com/livekit/livekit/releases/tag/v1.9.11), [Compose override semantics](https://docs.docker.com/reference/compose-file/merge/).
