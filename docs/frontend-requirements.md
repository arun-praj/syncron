# Frontend requirements

Syncron is a Chrome and Firefox extension built with WXT, React, TypeScript and Zustand. All product screens live in the extension. The backend only serves the signed invite handoff page.

## Flow

Users sign up or log in. Email/password signup requires a six-digit email OTP. After verification, onboarding requires a username and one bundled avatar. The extension ships 30 curated Tapback Memoji PNGs with attribution; it never requests avatar images at runtime and has no upload flow. Google users skip email OTP but still complete onboarding.

The home screen shows YouTube, Spotify, Netflix and generic HTML5 entry points. On a supported media page it goes directly to party creation. A party cannot start until a specific playable video/audio page URL is detected. Creation submits the page media descriptor and the `everyoneCanControl` toggle in one request.

## Invites and media

The host shares `https://<api-origin>/join#invite=<token>`. The content script on the handoff page removes the fragment immediately, keeps the token in transient extension memory, and sends it to the background service. The API validates it and returns the party's current media destination. The extension navigates the designated tab to that webpage, then attaches the session UI. It never appends the invite token to a provider URL.

New joins follow the party's current media. Later authorized media changes automatically navigate the designated party tab. Browser autoplay restrictions may require a user click. Full, ended, rotated, invalid and unavailable media states have visible error actions.

## Session UI

The attached panel shows the current media, invite sharing, participants, host status, playback controls, camera/microphone controls, LiveKit video tiles and ephemeral LiveKit chat. The host can kick, transfer host, end the party, change playback permissions, and allow or prevent a member's microphone publishing. A member can mute incoming audio locally. Host microphone restriction cannot remotely turn a microphone on.

The panel has minimize and draggable in-page float modes. It keeps one playback socket and one LiveKit participant through transitions. YouTube fullscreen uses an 80/20 video/sidebar layout. Generic media uses a Syncron fullscreen wrapper when the page accepts injected children; otherwise native fullscreen remains available with the sidebar limitation shown.

## Browser rules

Use browser runtime APIs for navigation, messaging and extension URLs. Keep page DOM access in content scripts and keep API/LiveKit secrets on the server. Request camera or microphone access only after a user action. Reconnect with bounded backoff and request authoritative playback state before publishing local corrections. Do not persist chat or invite tokens.

Full frontend acceptance requires Chrome and Firefox runs for signup/onboarding, invite handoff, YouTube navigation, generic media sync, party moderation, fullscreen, minimize/float, reconnect, autoplay denial and permission denial. Spotify and Netflix expose experimental or unsupported states until dedicated adapters exist.
