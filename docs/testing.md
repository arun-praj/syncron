# Testing Strategy

Backend milestone scope and implemented behavior are defined by [backend development](backend-development.md), [API](API-schema.md), and [database](db-schema.md). Extension/UI sections are future requirements.

## 1. Unit tests

Use Vitest.

Cover:

- username validation,
- invite signatures and rotation,
- room permission rules,
- host failover selection,
- WebSocket Zod schemas,
- playback state projection/drift calculations,
- adapter selection,
- feedback-loop suppression logic.

## 2. Backend integration tests

Use temporary SQLite database created from migrations.

Cover:

- auth-protected endpoints,
- room create/join/leave/end,
- invite-only initial joins,
- room capacity 25,
- host-only operations,
- host transfer,
- kick,
- LiveKit token endpoint authorization,
- ended-room denial,
- no chat persistence table/path.

## 3. Realtime tests

Run multiple WebSocket clients and verify:

- join state synchronization,
- ordered sequence handling,
- forbidden playback control rejection,
- all-member control when enabled,
- host-only control when disabled,
- reconnect receives authoritative state,
- host disconnect grace and failover,
- room end disconnects clients.

## 4. Extension tests

Unit/integration tests for adapters using DOM fixtures/mocks where possible.

Playwright E2E should cover at least:

- two browser contexts joining same room,
- generic HTML5 play/pause/seek sync,
- control toggle behavior,
- reconnect behavior.

YouTube/Spotify E2E may require separate tagged tests because external services are less deterministic.

## 5. Docker smoke test

CI or local script should be able to:

1. `docker compose up -d --build`,
2. wait for health,
3. run API integration smoke tests,
4. verify LiveKit token generation/config path,
5. tear down services.
