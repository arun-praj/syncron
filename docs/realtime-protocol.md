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

The server validates:

- active membership,
- room status,
- playback-control permission,
- payload schema,
- reasonable numeric bounds.

## 4. Drift strategy

Target typical drift: <= 500 ms.

Suggested approach:

1. Estimate network/server clock offset using ping/pong samples.
2. When applying a playing state, project expected position using elapsed server time.
3. Compare local media position with projected target.
4. Small drift: optionally apply temporary playback-rate correction where adapter permits.
5. Large drift (> ~1500 ms): hard seek.

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

On unexpected host control-channel disconnect:

- start 30-second grace timer,
- if host reconnects, cancel timer,
- otherwise select longest-connected active eligible participant,
- persist new `host_user_id` and role changes,
- broadcast `room.host_changed`.

## 10. Session termination

On room end:

- reject new protocol connections,
- emit `room.ended`,
- close sockets gracefully where possible,
- delete transient coordinator state.

## Implemented recovery and limits

See the [canonical API](API-schema.md#precise-realtime-rules) for heartbeat, sequence rejection, seek coalescing, single-use tickets, five-minute empty recovery, restart behavior and rate limits. All client and server payload schemas are exported by packages/protocol. The future YouTube fullscreen layout is 80% video / 20% persistent sidebar, with generic-site support conditional on the fullscreen container accepting injected children.
