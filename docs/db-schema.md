# Database Schema — Canonical

**Status:** Canonical persistent database contract for Phase 1.

Any persistent schema or persistence-behavior change MUST update this file in the same implementation change.

## 1. Database targets

Development: SQLite.

Production target: Cloudflare D1.

ORM: Drizzle ORM using SQLite-compatible column types and migration patterns.

## 2. Persistence boundary

### Persisted

- authentication/users/accounts/sessions/verifications required by Better Auth,
- Syncron user profile data,
- original room media descriptor (provider, media id, page URL),
- rooms,
- historical room membership.

### Never persisted in Phase 1

- text chat messages,
- chat message bodies,
- webcam/video streams,
- microphone/audio streams,
- WebRTC signaling state,
- active playback position/state,
- active presence,
- ICE data,
- LiveKit participant state.

## 3. Better Auth tables

Better Auth owns the canonical authentication schema. Generate/integrate its required SQLite tables using the Better Auth version chosen during implementation.

At minimum the authentication model includes Better Auth equivalents of:

- `user`,
- `account`,
- `session`,
- `verification`.

Do not manually add plaintext password fields.

Because Better Auth schemas can vary by configured plugins/version, the generated migration is the implementation authority for Better Auth-internal columns, but this document remains authoritative for Syncron-owned data and integration requirements.

### Required Better Auth user semantics

The auth user must support:

- `id` — string primary identifier,
- `email` — required,
- `emailVerified` — boolean,
- `name` or display name,
- `image` — nullable profile image URL,
- created/updated timestamps as provided by Better Auth.

## 4. `user_profiles`

Syncron-specific profile data keyed 1:1 to the Better Auth user.

| Column | Type | Null | Constraints | Notes |
|---|---|---:|---|---|
| `user_id` | TEXT | no | PK, FK -> Better Auth user.id | 1:1 identity |
| `username` | TEXT | no | | non-unique editable normalized label |
| `created_at` | INTEGER/TEXT timestamp | no |  | UTC |
| `updated_at` | INTEGER/TEXT timestamp | no |  | UTC |
| `avatar_id` | TEXT | yes | one of bundled IDs 1–30 | stable extension avatar |
| `onboarding_completed_at` | timestamp | yes | | required before party create/join |

### Username rules

Application validation:

- 3–32 characters,
- lowercase canonical form recommended,
- allowed: letters, digits, underscore, period,
- no leading/trailing period,
- reserve system names such as `admin`, `support`, `syncron`.

Initial label: normalized email local part, then provider first name, then user; apply the same validation and reserved-name rules.

## 5. `rooms`

| Column | Type | Null | Constraints | Notes |
|---|---|---:|---|---|
| `id` | TEXT | no | PK | UUIDv7 recommended |
| `name` | TEXT | yes |  | optional room name |
| `creator_user_id` | TEXT | no | FK -> auth user.id | immutable creator |
| `host_user_id` | TEXT | no | FK -> auth user.id | current host while active; final host retained after end |
| `invite_version` | INTEGER | no | CHECK >=1, default 1 | signed invite revocation counter |
| `status` | TEXT | no | CHECK | `ACTIVE` or `ENDED` |
| `everyone_can_control` | INTEGER/BOOLEAN | no |  | default true |
| `allow_members_to_share_invite` | INTEGER/BOOLEAN | no |  | default false; permits active members to fetch the current signed invite |
| `max_participants` | INTEGER | no | CHECK =25 | Phase 1 default/max 25 |
| `created_at` | timestamp | no |  | UTC |
| `updated_at` | timestamp | no |  | UTC |
| `ended_at` | timestamp | yes |  | set once room ends |
| `media_provider` | TEXT | yes | `GENERIC`, `YOUTUBE`, `SPOTIFY`, `NETFLIX` | original navigation descriptor |
| `media_id` | TEXT | yes | | provider identifier when available |
| `media_url` | TEXT | yes | HTTPS/HTTP page URL | never a raw stream URL |

### Room constraints

- `ENDED` requires `ended_at` at application level.
- Ended rooms are immutable except safe administrative/internal metadata fixes.
- Partial unique indexes allow only one `ACTIVE` room per creator and per current host.

### Recommended indexes

- index on `creator_user_id`,
- index on `host_user_id`,
- index on `(status, created_at)`.

## 6. `room_memberships`

Historical participation records.

| Column | Type | Null | Constraints | Notes |
|---|---|---:|---|---|
| `id` | TEXT | no | PK | UUIDv7 recommended |
| `room_id` | TEXT | no | FK -> rooms.id | |
| `user_id` | TEXT | no | FK -> auth user.id | |
| `role` | TEXT | no | CHECK | `HOST` or `MEMBER` snapshot/current persisted role |
| `joined_at` | timestamp | no |  | UTC |
| `left_at` | timestamp | yes |  | UTC |
| `leave_reason` | TEXT | yes | CHECK when non-null | see values below |
| `microphone_allowed` | INTEGER/BOOLEAN | no | default true | host restriction persisted across reconnects |

### `leave_reason`

Allowed values:

- `LEFT`
- `KICKED`
- `ROOM_ENDED`
- `DISCONNECTED_TIMEOUT`

### Membership semantics

A user may join the same room multiple times after disconnect/reconnect. Prefer one active membership interval at a time.

Recommended model:

- create a new membership row when a user joins after a completed `left_at`, or
- reuse the active row for short reconnects during connection grace period.

Implementation must choose one deterministic policy and test it. Recommended Phase 1 policy: reuse an active membership during transient reconnect grace; otherwise create a new historical interval.

### Recommended indexes

- index on `(room_id, joined_at)`,
- index on `(user_id, joined_at)`,
- partial/logic enforcement that a user has at most one active membership interval per room where practical.

## 7. No chat table

There MUST NOT be a `chat_messages` table in Phase 1.

Text chat is carried through LiveKit and intentionally disappears with the realtime session.

Do not add chat persistence for debugging.

## 8. No playback-state table

There MUST NOT be a persistent `playback_state` table in Phase 1.

Authoritative playback state is transient and owned by the active room coordinator.

Local development: process-memory coordinator implementation.

Production target: Durable Object per active room.

## 9. Deletion and retention

Phase 1 retains ended room metadata and historical membership rows indefinitely unless a later retention policy is introduced.

Account deletion behavior must be designed before production launch; implementation must account for foreign-key references and privacy requirements.

## 10. Migration requirements

- Every schema change uses a committed Drizzle migration.
- Never edit a migration that has already shipped to a shared/production environment; create a new migration.
- D1 compatibility must be checked before merging migrations.
- Tests must initialize a clean SQLite database from migrations.

Active membership uniqueness is enforced by a partial unique index on (room_id,user_id) WHERE left_at IS NULL. Timestamps use epoch milliseconds in SQLite. Active memberships survive transient disconnects, extension/page reloads, and API restarts until explicit leave, kick, or room end; transient playback state may be lost on API restart. No invite tokens are stored.
