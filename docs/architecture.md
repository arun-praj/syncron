# Syncron Architecture

Backend milestone scope and implemented behavior are defined by [backend development](backend-development.md), [API](API-schema.md), and [database](db-schema.md). Extension/UI sections are future requirements.

## 1. High-level architecture

```text
Chrome / Firefox Extension
  |
  |-- HTTPS --------------------------> Syncron API (Hono)
  |                                      |-- Better Auth
  |                                      |-- Room management
  |                                      |-- LiveKit token minting
  |                                      |-- SQLite (dev) / D1 (prod)
  |
  |-- WSS ----------------------------> Playback Realtime Service
  |                                      |-- authoritative playback state
  |                                      |-- presence/control protocol
  |
  |-- WebRTC / LiveKit protocol ------> LiveKit SFU
                                         |-- microphone
                                         |-- camera
                                         |-- ephemeral text
                                         |-- media participant state
```

The watched/listened source media is loaded directly by each user's browser from the source website. It does not pass through Syncron infrastructure.

## 2. Monorepo layout

Recommended structure:

```text
syncron/
├── apps/
│   ├── api/
│   └── extension/
├── packages/
│   ├── auth/
│   ├── db/
│   ├── protocol/
│   ├── shared/
│   ├── validation/
│   └── media-adapters/
├── drizzle/
├── docs/
├── docker-compose.yml
├── .env.example
├── pnpm-workspace.yaml
├── package.json
└── CLAUDE.md
```

## 3. Backend framework

Use Hono + TypeScript.

Local runtime may run as a Node-compatible Hono server.

Production target is Cloudflare Workers. Avoid Node-only APIs in domain code where a Web/Workers-compatible alternative exists.

## 4. Persistence

Development: SQLite.

Production: Cloudflare D1.

Use Drizzle ORM with SQLite-compatible schemas.

Persistent state:

- Better Auth data,
- Syncron user profile fields not owned by Better Auth,
- rooms,
- room membership history.

Transient state:

- playback state,
- current realtime presence,
- ephemeral text chat,
- WebRTC/media state,
- disconnect grace timers.

Do not add transient state to the persistent database without changing the product specification and `db-schema.md`.

## 5. Authentication

Use Better Auth.

Supported methods:

- Google OAuth,
- email/password.

Use Better Auth's account/session/verification tables instead of inventing custom credential storage.

The Syncron user profile should reference the Better Auth user identity or extend the Better Auth user record through supported schema fields.

## 6. LiveKit boundary

LiveKit handles:

- WebRTC signaling,
- SFU routing,
- audio tracks,
- video tracks,
- participant media state,
- ephemeral text/data transport,
- connection quality/active speaker primitives.

Syncron backend handles:

- whether a user is allowed into a room,
- minting scoped LiveKit access tokens,
- mapping Syncron room/user identity to LiveKit room/participant identity.

Do not expose the LiveKit API secret to the extension.

### LiveKit room naming

Use an internal deterministic mapping such as:

`sync_<room_id>`

Never trust a client-supplied LiveKit room name.

## 7. Playback realtime boundary

Playback synchronization remains Syncron-owned and independent from LiveKit.

Reasons:

- watch-party synchronization works even when webcam/microphone is disabled,
- playback protocol can evolve independently,
- authorization of playback control remains explicit,
- easier migration to Durable Objects in production.

Local Phase 1 implementation may keep active room state in API process memory, but code must isolate state behind a `RoomCoordinator` interface.

Production implementation target: Cloudflare Durable Object per active room.

## 8. RoomCoordinator abstraction

Suggested interface responsibilities:

```ts
interface RoomCoordinator {
  join(connection: RoomConnection): Promise<void>
  leave(connectionId: string): Promise<void>
  applyPlaybackEvent(event: PlaybackControlEvent): Promise<void>
  getPlaybackState(): Promise<PlaybackState | null>
  setHost(userId: string): Promise<void>
  setEveryoneCanControl(value: boolean): Promise<void>
  endRoom(reason: RoomEndReason): Promise<void>
}
```

Avoid coupling handlers directly to an in-memory `Map` implementation.

## 9. Shared schemas

`packages/protocol` is the source of truth for transport contracts that are consumed by multiple apps.

Use Zod schemas and infer TypeScript types.

Examples:

- room REST DTOs,
- playback state,
- WebSocket envelope,
- WebSocket events,
- public user summary,
- error schema.

Do not manually mirror the same type in API and extension.

## 10. IDs

Use non-sequential, globally unique IDs such as UUIDv7 or ULID.

Recommended:

- persistent resource IDs: UUIDv7,
- request correlation IDs: UUID/ULID,
- invites: signed room ID and invite-version claims in a URL fragment.

Do not expose database rowids.

## 11. Time

Persist timestamps as UTC.

API timestamps use RFC 3339 / ISO 8601 strings.

Realtime playback synchronization should use monotonic local clocks for local measurements and server-provided epoch timestamps for cross-client coordination.

## 12. Error model

All Syncron REST errors should use the common shape defined in `API-schema.md`.

Internal stack traces must never be sent to clients in production.
