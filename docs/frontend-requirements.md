# Frontend requirements

Syncron is a Chrome and Firefox extension built with WXT, React, TypeScript and Zustand. All product screens live in the extension. The backend only serves the signed invite handoff page.

## Flow

Users sign up or log in. Email/password signup requires a six-digit email OTP. Verification opens in a dedicated extension tab so it survives popup closure; the tab is verification-only, shows a confirmation after success, and directs the user back to the popup for login. Direct tab access never renders login or the home page. Only the pending email and OTP expiry are resumable in extension storage, never the password or OTP. After verification, onboarding requires a username and one bundled avatar. The extension ships 30 bundled Tapback Memoji WebP snapshots, sourced from the open-source Tapback-Memojis project and its documented avatar API; it never requests avatar images at runtime and has no upload flow. Google users skip email OTP but still complete onboarding. The signed-in popup header opens a profile page showing the current avatar, username, email, and verification status, with a visible hover affordance and a back-to-home action. The profile page provides an accessible change-password form backed by Better Auth's authenticated `POST /api/auth/change-password`, revokes other sessions on success, and preserves the rotated bearer token. Streaming service cards use bundled Simple Icons brand SVGs; sign out is available from the profile page. The YouTube flow uses a tab-scoped in-page sidebar; clicking YouTube from the popup opens a new target tab and mounts Syncron only in that tab.

The home screen shows YouTube, Spotify, Netflix and generic HTML5 entry points. Clicking YouTube creates a target tab and mounts an in-page sidebar only there; switching tabs hides it naturally, and returning to the target tab preserves its mounted UI state. Other YouTube tabs do not show Syncron. On a supported media page it goes directly to party creation. A party cannot start until a specific playable video/audio page URL is detected. Creation submits the page media descriptor, `everyoneCanControl`, and `allowMembersToShareInvite` toggles in one request. Both permissions are off by default.

## Invites and media

The host shares `https://<api-origin>/join#invite=<token>`. The content script on the handoff page removes the fragment immediately, keeps the token in transient extension memory, and sends it to the background service. The API validates it and returns the party's current media destination. The extension navigates the designated tab to that webpage, then attaches the session UI. It never appends the invite token to a provider URL.

New joins follow the party's current media. Later authorized media changes automatically navigate the designated party tab. Browser autoplay restrictions may require a user click. Full, ended, rotated, invalid and unavailable media states have visible error actions.

## Session UI

The attached panel shows the current media, invite sharing, participants, host status, playback controls, camera/microphone controls, LiveKit video tiles and ephemeral LiveKit chat. The host can kick, transfer host, end the party, change playback permissions, enable member invite sharing, and allow or prevent a member's microphone publishing. A member can fetch the current invite only when the host enables invite sharing. Host microphone restriction cannot remotely turn a microphone on.

The YouTube panel can be minimized to a small tab-local handle and preserves its React state while the target tab remains loaded. It keeps one playback socket and one LiveKit participant through transitions. YouTube fullscreen uses an 80/20 video/sidebar layout. Generic media uses a Syncron fullscreen wrapper when the page accepts injected children; otherwise native fullscreen remains available with the sidebar limitation shown.

## Browser rules

Use browser runtime APIs for navigation, messaging and extension URLs. Keep page DOM access in content scripts and keep API/LiveKit secrets on the server. Request camera or microphone access only after a user action. Reconnect with bounded backoff and request authoritative playback state before publishing local corrections. Do not persist chat or invite tokens.

Full frontend acceptance requires Chrome and Firefox runs for signup/onboarding, invite handoff, YouTube navigation, generic media sync, party moderation, fullscreen, minimize/float, reconnect, autoplay denial and permission denial. Spotify and Netflix expose experimental or unsupported states until dedicated adapters exist.
