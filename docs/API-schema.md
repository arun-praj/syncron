# API Schema — Canonical

Phase 1 backend contract. All /api/v1 routes require a verified Better Auth bearer session. User IDs always refer to Better Auth; usernames are editable, non-unique labels. Resource IDs are UUIDv7. JSON input is strict and bounded.

Better Auth is mounted at /api/auth/*. Its authenticated `POST /api/auth/change-password` endpoint accepts `{currentPassword,newPassword,revokeOtherSessions?}` and returns `{token,user}`, where `token` may be null and is rotated when `revokeOtherSessions` is true. Email/password requires verification using six-digit email OTPs (300 seconds, three attempts, hashed, rotating resend, 60-second cooldown). Recovery uses email OTP. Google must assert email_verified=true and bypasses Syncron OTP. Email changes and deletion are disabled.

## REST

| Method/path under /api/v1 | Input | Result | Permission |
|---|---|---|---|
| GET /me | — | {user} | authenticated |
| PATCH /me | {username?,displayName?,avatarId?}, at least one | {user} | self |
| POST /me/onboarding | {username,avatarId,displayName?} | {user} | verified user without/with onboarding |
| GET /users/:userId | — | {user} public profile | authenticated |
| POST /rooms | {name?,everyoneCanControl,allowMembersToShareInvite,media:{provider,mediaId,url},initialPlayback?:{position,paused,playbackRate,muted,volume}} | 201 {room,inviteUrl}; 200 with the existing active room when the caller is already its host | authenticated and onboarded |
| POST /rooms/preview | {invite} | {preview:{name,title,host,media,participantCount,maxParticipants,everyoneCanControl,allowMembersToShareInvite}}; does not create membership | authenticated and onboarded |
| GET /rooms/previous | — | {room:null|room}; returns the caller's latest active party they left voluntarily or lost connection from | authenticated and onboarded |
| GET /rooms/:roomId | — | {room} | historical member |
| GET /rooms/:roomId/invite | — | {inviteUrl} | active host, or active member when `allowMembersToShareInvite=true` |
| POST /rooms/:roomId/invite/rotate | {} | {inviteUrl} | active host |
| POST /rooms/join | {invite} | {room,membership} | authenticated |
| POST /rooms/:roomId/join | {invite} | {room,membership} | authenticated; matching room |
| POST /rooms/:roomId/rejoin | {} | {room,membership} | historical member whose latest departure was not a kick |
| POST /rooms/:roomId/leave | `{disband?,transferTo?}` | 204 | active member; host may disband or transfer host access before leaving; repeated leave is safe |
| POST /rooms/:roomId/end | {} | 204 | active host |
| PATCH /rooms/:roomId/settings | {everyoneCanControl:boolean} | {room} | active host |
| GET /rooms/:roomId/members | — | {members} | active member |
| POST /rooms/:roomId/kick | {userId} | 204 | active host; not self |
| POST /rooms/:roomId/transfer-host | {userId} | {host} | active host; connected active member who does not host another active room |
| POST /rooms/:roomId/ws-ticket | {} | {ticket,expiresAt} | active member |
| POST /rooms/:roomId/livekit-token | {} | {url,token,roomName,participantIdentity} | active member |
| PATCH /rooms/:roomId/members/:userId/microphone | {allowed:boolean} | {allowed} | active host |

`POST /rooms/:roomId/transfer-host` returns `409 INVALID_HOST_TRANSFER` and
leaves the room unchanged when the target is not a connected active member or
already hosts another active room.

Media destinations are strict. YouTube destinations must use an HTTPS `youtube.com` or `www.youtube.com` URL with a `/watch?v=` video path. The URL must identify a video, and a non-null `mediaId` must match that URL identifier; a null YouTube `mediaId` is allowed when the URL provides the identifier.

Only one `ACTIVE` room may have a given current host. Repeating `POST /rooms` while that room is active is idempotent and returns that room instead of creating another one. A former creator who voluntarily leaves may start a new room while the previous room continues under its transferred host; the previous-room endpoint and rejoin route make that choice explicit.

Room: id, name, status, everyoneCanControl, allowMembersToShareInvite, maxParticipants (25), host (PublicUser), createdAt, endedAt, media (destination or null), hasPlaybackState. PublicUser: id, username, avatarId, displayName, image. /me additionally includes email, emailVerified, createdAt, onboardingCompletedAt. Member: user, role, joinedAt, connected, microphoneAllowed. Timestamps are ISO UTC.

Invites are HMAC-SHA256 signed roomId/inviteVersion claims, in APP_URL/join#invite=<token>. No codes, access modes or passwords. The preview validates the signed invite, room status, onboarding and current media without creating membership. Initial join requires an invite; existing active memberships reconnect using tickets without an invite. Rotation increments persisted version and revokes old invites. Invite tokens are never persisted or logged.

Errors use {error:{code,message,requestId,details:null}}: 400 VALIDATION_ERROR; 401 UNAUTHENTICATED; 403 FORBIDDEN, INVITE_INVALID, NOT_ROOM_MEMBER, NOT_ROOM_HOST, CANNOT_KICK_SELF, CANNOT_TRANSFER_TO_SELF; 404 ROOM_NOT_FOUND, USER_NOT_FOUND; 409 ONBOARDING_REQUIRED, ROOM_ENDED, ROOM_FULL, TARGET_NOT_IN_ROOM, INVALID_HOST_TRANSFER; 429 RATE_LIMITED; 503 LIVEKIT_TOKEN_UNAVAILABLE, LIVEKIT_MODERATION_PENDING; 500 INTERNAL_ERROR.

GET /healthz returns {status:'ok'} after a database probe. GET /readyz also checks LiveKit and SMTP; returns 503 on failure.

## WebSocket

GET /api/v1/rooms/:roomId/ws?ticket=<ticket>. Random room-scoped ticket expires after 30 seconds and is consumed once. Session credentials never appear in the URL. Invalid upgrades return 401/403/409.

### Common client envelope

```json
{
  "type": "playback.play",
  "requestId": "req_...",
  "sequence": 42,
  "sentAt": 1789378100123,
  "payload": {}
}
```

### Common server envelope

```json
{
  "type": "playback.state",
  "eventId": "evt_...",
  "serverSequence": 103,
  "serverTime": 1789378100180,
  "payload": {}
}
```

Clients must ignore unknown optional fields for forward compatibility.

## 9. Playback state schema

```json
{
  "provider": "YOUTUBE",
  "mediaId": "dQw4w9WgXcQ",
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "position": 1842.412,
  "paused": false,
  "playbackRate": 1,
  "muted": false,
  "volume": 1,
  "updatedAt": 1789378100180,
  "updatedBy": "usr_...",
  "stateSequence": 103
}
```

Provider values:

- `GENERIC`
- `YOUTUBE`
- `SPOTIFY`
- `NETFLIX` (experimental)

`mediaId` may be null for generic sources when no stable identifier is available.

## 10. Client -> server WebSocket events

### `playback.sync_request`

Payload:

```json
{}
```

Server responds with latest `playback.state` or `playback.no_state`.

### `playback.play`

```json
{
  "position": 1842.412,
  "provider": "YOUTUBE",
  "mediaId": "dQw4w9WgXcQ",
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
}
```

Authorization: host always; members only when `everyoneCanControl=true`.

### `playback.pause`

Same payload fields as `playback.play`.

### `playback.seek`

```json
{
  "position": 2011.82,
  "provider": "YOUTUBE",
  "mediaId": "dQw4w9WgXcQ",
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "paused": false
}
```

`paused` is optional for compatibility with older clients. When present, it
preserves the host's play/pause intent while the provider completes its seek.

### `playback.rate_change`

```json
{
  "playbackRate": 1.25,
  "position": 2011.82
}
```

### `playback.media_change`

```json
{
  "provider": "YOUTUBE",
  "mediaId": "new-media-id",
  "url": "https://www.youtube.com/watch?v=...",
  "position": 0,
  "paused": true,
  "muted": false,
  "volume": 1,
  "metadata": {
    "title": "Optional display title"
  }
}
```

`metadata` is optional and must remain small. Do not trust it for security decisions.
The media destination is immutable while the room is active. A media-change
event for a different destination is rejected and the sender is resynchronized
to the current `playback.state`; same-media snapshots remain valid for recovery.

### `playback.audio_change`

```json
{
  "position": 2011.82,
  "muted": true,
  "volume": 0.35
}
```

Mute and volume are synchronized playback-audio state; LiveKit microphone state remains independent. Authorization is the same as other playback controls.

### `playback.buffering`

```json
{
  "buffering": true,
  "position": 2011.82
}
```

Phase 1 buffering notifications are informational and do not automatically pause the whole room unless a later policy is defined.

### `client.ping`

```json
{ "clientTime": 1789378100123 }
```

## 11. Server -> client WebSocket events

### `connection.ready`

```json
{
  "connectionId": "conn_...",
  "roomId": "room_...",
  "userId": "usr_...",
  "serverTime": 1789378100180
}
```

### `playback.state`

Payload: canonical PlaybackState.

### `playback.no_state`

```json
{}
```

### `playback.control_rejected`

```json
{
  "requestId": "req_...",
  "code": "PLAYBACK_CONTROL_FORBIDDEN"
}
```

### `room.member_joined`

```json
{
  "member": {
    "user": { "id": "usr_...", "username": "alex", "displayName": "Alex", "image": null },
    "role": "MEMBER",
    "joinedAt": "2026-09-14T12:01:00Z",
    "connected": true
  }
}
```

### `room.member_left`

```json
{
  "userId": "usr_...",
  "reason": "LEFT"
}
```

### `room.host_changed`

```json
{
  "host": { "id": "usr_...", "username": "alex", "displayName": "Alex", "image": null }
}
```

### `room.settings_changed`

```json
{ "everyoneCanControl": false }
```

### `room.kicked`

Sent to target before disconnect when possible.

```json
{ "reason": "KICKED_BY_HOST" }
```

### `room.ended`

```json
{
  "endedAt": "2026-09-14T13:00:00Z",
  "reason": "HOST_ENDED"
}
```

### `server.pong`

```json
{
  "clientTime": 1789378100123,
  "serverTime": 1789378100180
}
```

### `protocol.error`

```json
{
  "requestId": "req_...",
  "code": "VALIDATION_ERROR",
  "message": "Invalid playback event"
}
```

## 12. WebSocket ordering

- Server assigns monotonically increasing `serverSequence` per active room coordinator.
- Clients ignore stale playback state/events with lower/equal sequence than already applied state when appropriate.
- On reconnect, client always requests/safely receives authoritative state before emitting speculative correction events.



## Precise realtime rules

Client sequence is strictly increasing per socket; stale values produce STALE_SEQUENCE. All events require active membership. Controls require host or everyoneCanControl. Invalid payloads produce protocol.error VALIDATION_ERROR; controls over 30/sec sustained, burst 60 produce RATE_LIMITED. Send client.ping at least every 15 seconds; 30 seconds without an event closes the socket. Replacing a socket cannot disconnect its replacement. Seek broadcasts are coalesced to the latest accepted state over 50ms; another control flushes the pending seek first. Initial connection automatically receives state/no_state. Playback positions must be finite and nonnegative, rates 0.25–4, volumes 0–1, http(s) URLs at most 2048 characters, titles at most 200. Buffering is informational and returns playback.buffering with userId, buffering and position. Play, pause and seek before initial playback state produce NO_PLAYBACK_STATE; `playback.media_change` is the initialization/recovery event and must use the locked destination. Rate and audio changes before initial media produce NO_PLAYBACK_STATE. A host receiving playback.no_state after a coordinator restart republishes its current full playback snapshot; members wait for that state.

Disconnected members retain their active membership and reserve capacity for a 30-second reconnect grace period. Reconnecting within that grace reuses the active membership; otherwise it closes with `DISCONNECTED_TIMEOUT`. Playback and presence remain transient; a server restart may lose playback state, but it does not end the persisted active room. After a disconnected host's grace expires, a random connected active member who does not host another active room becomes host; if no eligible member is connected, the room ends. Explicit host leave transfers immediately to a random eligible connected member, or ends the room when none is eligible. The `room.host_changed` event is shown to the new host as `You are now the host` and to other members as a system chat notification naming the new host. Repeated leave requests are safe. Ending closes memberships with `ROOM_ENDED` and destroys transient state.

LiveKit tokens expire in 600 seconds; roomName=sync_<roomId>, identity=Better Auth user ID. Grants: join, subscribe, data, camera and microphone publishing. Kick removes the participant; end deletes the LiveKit room. Chat travels only through LiveKit.
