# Implementation plan

1. Update shared Zod contracts, migrations and canonical API/database documents. Add the frontend/backend requirements and agent index.
2. Add onboarding/avatar catalog, atomic profile updates, and onboarding guards.
3. Add initial media descriptors, creation-time playback policy, current-media/restart fallback responses, and the invite handoff page.
4. Add host microphone moderation and LiveKit grant enforcement with reconnect-safe membership state.
5. Add the WXT extension: auth, onboarding, bundled avatars, media detection, YouTube/generic adapters, party creation, invite handoff, session sidebar, LiveKit UI, chat, fullscreen, minimize/float and reconnect.
6. Validate Chrome and Firefox flows, then run all backend and Docker checks.

The first frontend slice is invite validation followed by automatic YouTube navigation and an attached sidebar. Spotify and Netflix remain experimental until adapters pass their browser-specific acceptance tests.

## Current implementation status

Completed: contracts and migration, onboarding/avatar catalog, atomic room media/control settings, signed invite handoff and current-media recovery, host microphone persistence/LiveKit enforcement, WXT Chrome/Firefox builds, bundled avatars, media detection, invite navigation, attached/minimized/floating sidebar shell, and the backend/Docker checks.

Follow-up work before store release: complete Google extension proof-of-possession exchange, add the full LiveKit client video/chat controls and Syncron fullscreen wrapper, and run real Chrome/Firefox acceptance tests with autoplay and device-permission fallbacks.
