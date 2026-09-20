# Phase 1 Product Specification

Backend milestone scope and implemented behavior are defined by [backend development](backend-development.md), [API](API-schema.md), and [database](db-schema.md). Extension/UI sections are future requirements.

## 1. Product summary

Syncron is a browser extension for Chrome and Firefox that allows a group to watch video or listen to music together while remaining synchronized. Participants can optionally use webcam, microphone, and ephemeral text chat.

Syncron does **not** stream the watched media through its own servers. Each participant loads the source independently; Syncron synchronizes control state such as play, pause, seek, playback rate, and media changes.

## 2. Phase 1 scope

### Included

- Google authentication.
- Email/password authentication.
- Required username.
- User profile image.
- Private/unlisted rooms.
- Signed, host-rotatable invite URLs.
- Bearer invite URL with token in its fragment.
- Maximum 25 participants per room.
- Host role and participant role.
- Host transfer.
- Kick participant.
- Host control over whether all members can control playback.
- Automatic host failover after disconnect grace period.
- Generic HTML5 media synchronization.
- YouTube normal video and playlist synchronization.
- Spotify Web Player adapter, treated as experimental.
- Self-hosted LiveKit video and voice chat.
- Ephemeral LiveKit text chat.
- No persistence of text chat.
- Chrome support.
- Firefox support.
- Automatic reconnect for transient disconnections.
- Docker Compose local development.

### Explicitly deferred

- Public room discovery.
- Anonymous/guest participants.
- Screen sharing.
- Friend system.
- Persistent direct messages.
- Persistent room chat.
- Room bans/block lists beyond active-session kick.
- Notifications.
- Reporting/moderation workflow.
- YouTube Shorts-specific behavior.
- YouTube Music-specific adapter.
- Live stream synchronization guarantees.
- Large-scale rooms beyond 25 participants.
- Recording.
- Mobile application.

## 3. Authentication

Every participant must have a Syncron account.

Supported methods:

1. Google OAuth.
2. Email + password.

Username is a required, editable, non-unique profile label. Only Better Auth user IDs identify users.

Use Better Auth for authentication, session management, password credentials, OAuth accounts, verification primitives, and related auth tables.

Do not add a password column to the Syncron `user` domain model.

## 4. Rooms

### Room properties

A room has:

- immutable internal ID,
- persisted invite version,
- optional display name,
- creator/host,
- status,
- signed invite URL (never persisted),
- playback-control policy,
- participant capacity,
- timestamps.

### Room status

- `ACTIVE`
- `ENDED`

An ended room can never be reactivated in Phase 1.

### Access

Rooms are private/unlisted.

Initial joins require a signed invite extracted from the URL fragment and submitted in the JSON request body. Host-only rotation increments the invite version and invalidates earlier links.

### Participant limit

Default and maximum Phase 1 capacity: **25**.

Do not make this client-configurable in Phase 1.

## 5. Host and moderation

The creator becomes the initial host.

Host capabilities:

- end room,
- kick a participant,
- transfer host role,
- toggle whether members can control synchronized playback,
- control playback regardless of toggle state.

### Playback-control toggle

Field: `everyone_can_control`.

Default: `true`.

When `true`, all room participants may emit accepted playback-control events.

When `false`, only the host may emit accepted playback-control events.

The server must enforce this. The extension UI is not authoritative.

### Host disconnect

When a host disconnects unexpectedly:

1. Start a 30-second grace period.
2. If host reconnects, ownership remains unchanged.
3. If host does not reconnect, assign host to the longest-connected currently active participant.
4. Broadcast `room.host_changed`.

Explicit room leave by the host may immediately transfer ownership without the grace period.

## 6. Session ending

A room ends when:

- host explicitly ends it, or
- the backend ends it according to session lifecycle policy.

When a room ends:

- mark database room `ENDED`,
- set `ended_at`,
- terminate room playback WebSocket connections,
- invalidate/stop future LiveKit access for that room,
- destroy transient playback state,
- allow LiveKit transient chat/media state to disappear,
- do not persist text chat.

Historical room and membership records remain in the persistent database.

## 7. Rejoining and reconnecting

Users may reconnect to an active room after refresh, extension restart, or temporary connection loss.

On reconnect, restore:

- room metadata,
- membership,
- participant list/presence,
- authoritative playback state.

Do **not** restore prior text messages.

Microphone and camera should default to OFF after a fresh extension/browser restart unless LiveKit/browser state safely preserves the existing active connection.

## 8. Video and voice

Use self-hosted LiveKit.

Capabilities:

- microphone on/off,
- camera on/off,
- deafen/mute incoming room audio locally,
- hide/unsubscribe video locally,
- active speaker information,
- connection quality information.

Syncron does not implement a custom SFU.

### Video subscription policy

Do not subscribe to every participant's highest-quality video by default.

Prefer:

- visible video tiles subscribed,
- hidden/offscreen video unsubscribed or reduced,
- audio kept subscribed when appropriate,
- LiveKit adaptive/dynacast capabilities enabled where useful.

Target UI: show roughly 4–6 active/selected camera tiles simultaneously by default even if more users have cameras enabled.

## 9. Text chat

Text chat is **ephemeral**.

Requirements:

- use LiveKit text/data capabilities,
- never write messages to SQLite/D1,
- never include message contents in application logs,
- messages disappear when users disconnect/room ends,
- reconnecting users do not receive earlier chat history.

The only acceptable persistence is in-memory/transient transport state managed by LiveKit while the active realtime session exists.

## 10. Playback synchronization

Syncron maintains one authoritative playback state per active room.

State includes:

- provider,
- media identity,
- canonical/source URL where appropriate,
- current position,
- paused/playing,
- playback rate,
- update timestamp,
- event sequence number,
- actor that last changed state.

### Synchronization targets

- Correction threshold: 10 ms, with temporary rate correction for small drift.
- Hard correction threshold: > 250 ms.

Use soft correction where practical before hard seeking.

### Initial state on join/rejoin

The server sends the latest authoritative playback state to the joining client.

The client adapter determines whether that state can be applied to the current page/media.

## 11. Media adapters

Implement a common adapter interface.

Priority:

1. site-specific adapter,
2. generic HTML media adapter.

### Generic HTML5 adapter

Support HTMLMediaElement-compatible `<video>` and `<audio>`.

If multiple media elements exist:

1. prefer currently playing media,
2. otherwise prefer largest visible video,
3. otherwise expose media selection UI.

### YouTube adapter

Phase 1 support:

- normal YouTube videos,
- playlists,
- play,
- pause,
- seek,
- playback rate when available,
- video/playlist item change detection.

Deferred:

- Shorts-specific behavior,
- YouTube Music-specific behavior,
- strict live-stream synchronization guarantees.

### Spotify Web adapter

Treat as experimental and isolate behind its own adapter.

Desired behavior where technically allowed:

- play,
- pause,
- seek,
- next track,
- previous track,
- track-change synchronization.

Syncron does not fetch, proxy, record, redistribute, or rebroadcast Spotify audio.

Spotify adapter failures must not break generic/YouTube adapters or room communication.

## 12. Media change UX

When controlling participant changes media:

- broadcast a media-change event,
- detect whether receiver is already on compatible media,
- if navigation is needed, present a clear `Open media` / `Follow host` action rather than silently navigating by default.

Automatic navigation can be considered later as an opt-in preference.

## 13. Nonfunctional requirements

- TypeScript strict mode.
- Structured JSON logging on backend.
- No chat message content in logs.
- API version prefix `/api/v1` for Syncron-owned REST endpoints.
- HTTPS/WSS in production.
- Zod validation on API and realtime boundaries.
- Automatic WebSocket reconnect using bounded exponential backoff + jitter.
- Heartbeats/ping-pong for connection health.
- Rate limiting on abuse-sensitive paths.
- Chrome and Firefox latest stable releases supported.
- Use WebExtension-compatible APIs through WXT abstractions where practical.
- Unit, integration, and E2E tests for critical paths.
