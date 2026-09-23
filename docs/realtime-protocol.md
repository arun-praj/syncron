# Playback Realtime Protocol

## 1. Purpose

This protocol synchronizes control state, not media bytes.

Video/audio source delivery remains between the participant's browser and the original media provider.

## 2. Architecture

Phase 1 local development may run playback coordination in API process memory.

Production target: one Cloudflare Durable Object per active room.

All room-state logic must be hidden behind a coordinator abstraction so this migration does not require rewriting protocol handlers.

## 3. Authoritative state

The room coordinator is authoritative.

Clients are event producers and state applicators, not authorities.

Authoritative playback includes the room's media destination, media position,
paused state, playback rate, YouTube mute state, and YouTube volume. The media
destination is locked for the lifetime of an active room; a participant must
leave before watching another video. A newly connected or reconnected
client applies the complete snapshot before publishing local controls; a host
republishes a complete snapshot when a coordinator has no transient state.

The server validates:

- active membership,
- room status,
- playback-control permission,
- payload schema,
- reasonable numeric bounds.

Seek events may include the sender's intended `paused` state. This optional
field prevents provider-generated pause events during a seek from changing the
authoritative play/pause state.

A `playback.media_change` for a different media destination is rejected and
the sender receives the current authoritative state. Same-media snapshots are
still accepted for reconnect/recovery compatibility.

When no transient playback state exists, `playback.media_change` is the only
event that can initialize or recover playback; play, pause and seek receive
`NO_PLAYBACK_STATE` until a complete snapshot exists.

## 4. Drift strategy

Target correction threshold: 10 ms. The client uses a temporary playback-rate correction for small drift and hard-seeks only when drift exceeds 250 ms.

Suggested approach:

1. Estimate network/server clock offset using ping/pong samples.
2. When applying a playing state, project expected position using elapsed server time.
3. Compare local media position with projected target.
4. Small drift: optionally apply temporary playback-rate correction where adapter permits.
5. Large drift (> 250 ms): hard seek.

Do not continuously hard-seek for tiny differences.

## 5. Feedback-loop prevention

Applying a remote event often triggers native media events (`play`, `pause`, `seeking`, etc.).

Adapters must distinguish:

- local user action,
- remote state application.

Use a short-lived suppression/token mechanism so a remote `seek` does not echo back as a new local `seek` and create an event loop.

## 6. Debouncing/coalescing

Seek events can fire rapidly.

- Debounce or coalesce noisy seeking updates.
- Coalesce YouTube `volumechange` events before publishing audio state.
- Emit authoritative seek at stable points such as `seeked` and optionally throttled preview updates.
- Playback position should not be broadcast at high frequency simply to act as a clock.

## 7. Reconnect

Use bounded exponential backoff with jitter.

Example progression:

- 250 ms,
- 500 ms,
- 1 s,
- 2 s,
- 4 s,
- cap around 10 s.

After reconnect:

1. authenticate,
2. verify active membership,
3. receive `connection.ready`,
4. request/receive authoritative playback state,
5. apply state,
6. resume normal local event publishing.

## 8. Presence

Playback WebSocket presence represents active Syncron control-channel connectivity.

LiveKit presence represents realtime communications connectivity.

Do not assume the two are identical. UI may combine them into one participant status model.

## 9. Host failover

Coordinator tracks host connection state.

On unexpected member control-channel disconnect:

- start 30-second grace timer,
- if the member reconnects, cancel its timer and preserve its membership,
- otherwise close its active membership with `DISCONNECTED_TIMEOUT`.

For a disconnected host, after the grace timer expires select a random
connected active member who does not host another active room, persist new
`host_user_id` and role changes, and broadcast `room.host_changed`. If no
eligible member is connected, end the room. An explicit host leave may either
disband the room or transfer ownership to the selected connected eligible
member; with no explicit choice it transfers immediately to a random eligible
connected member (the only remaining member in a two-person room when eligible)
or ends the room when none is eligible. Explicit transfer to a target that
already hosts another active room returns `INVALID_HOST_TRANSFER` (409).

## 10. Session termination

On room end:

- reject new protocol connections,
- emit `room.ended`,
- close sockets gracefully where possible,
- delete transient coordinator state.

## Implemented recovery and limits

See the [canonical API](API-schema.md#precise-realtime-rules) for heartbeat, sequence rejection, seek coalescing, single-use tickets, reload-safe memberships, restart behavior and rate limits. All client and server payload schemas are exported by packages/protocol. The future YouTube fullscreen layout is 80% video / 20% persistent sidebar, with generic-site support conditional on the fullscreen container accepting injected children.
