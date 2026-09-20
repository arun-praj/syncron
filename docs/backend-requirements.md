# Backend requirements

The Hono API remains the authority for Better Auth identity, onboarding, party membership, invitations, playback permissions and LiveKit grants. Better Auth user IDs are the only user identity in APIs, database relations, realtime events and LiveKit identities.

## Required changes

- `user_profiles` stores nullable `avatar_id` and `onboarding_completed_at`; valid avatar IDs are `1` through `30`.
- `/api/v1/me` returns avatar and onboarding status. `POST /api/v1/me/onboarding` completes onboarding atomically. `PATCH /api/v1/me` can change the username and avatar.
- Creating or joining a party requires completed onboarding.
- Room creation accepts `everyoneCanControl`, `allowMembersToShareInvite` (default false), an initial provider/media ID/page URL, and an optional fresh playback snapshot. The room stores only the initial media descriptor and permission settings; position, pause/rate, mute/volume state and chat remain transient in memory/LiveKit.
- Join and room responses expose the current coordinator media, with the persisted initial descriptor as restart fallback and `hasPlaybackState` to distinguish the two.
- `/join` returns a minimal no-analytics handoff page. Signed tokens remain fragment-only and are never logged or persisted.
- `GET /api/v1/rooms/:roomId/invite` remains host-only unless `allowMembersToShareInvite` is true; then active members may fetch the current signed invite. Rotation remains host-only.
- `PATCH /api/v1/rooms/:roomId/members/:userId/microphone` is host-only. It persists the active membership microphone permission, updates the LiveKit participant grant, mutes existing microphone tracks, and broadcasts the new state.
- LiveKit tokens grant camera publishing independently from microphone publishing. Reissued tokens preserve microphone restrictions.

Google extension OAuth uses a short-lived one-time exchange code bound to an extension proof-of-possession challenge; bearer sessions never appear in redirect URLs. Production trusted origins are explicit per browser/build. Development bypasses origin validation only when `NODE_ENV=development`.

## Persistence boundary

Persist Better Auth tables, profiles, rooms, initial media descriptors and historical memberships. Do not add playback-state or chat tables. Migrations must preserve existing rows: existing users receive incomplete onboarding with their current username as the suggested value, and existing rooms have no initial media descriptor.

## Verification

Cover migration compatibility, onboarding and avatar validation, creation settings/media, invite handoff and current-media joins, restart fallback, microphone restriction and reissued tokens, existing room lifecycle/realtime behavior, and no secret/chat persistence. Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, and the WSL Docker smoke test.
