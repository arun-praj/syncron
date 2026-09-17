# Browser Extension Architecture

Backend milestone scope and implemented behavior are defined by [backend development](backend-development.md), [API](API-schema.md), and [database](db-schema.md). Extension/UI sections are future requirements.

## 1. Framework

Use WXT + React + TypeScript.

Target:

- Chrome latest stable,
- Firefox latest stable.

Use WebExtension APIs through WXT/browser-compatible abstractions where possible.

## 2. Major extension contexts

```text
extension/
├── entrypoints/
│   ├── background/
│   ├── content/
│   ├── popup/
│   └── room-ui/ (side panel/overlay depending browser capability)
├── components/
├── stores/
├── services/
│   ├── api/
│   ├── playback-socket/
│   ├── livekit/
│   └── auth/
└── media/
    ├── adapter.ts
    ├── generic.ts
    ├── youtube.ts
    └── spotify.ts
```

Exact WXT entrypoint naming may differ; preserve responsibilities.

## 3. Background responsibilities

- authentication/session coordination,
- API access where appropriate,
- active room identity,
- extension lifecycle,
- message routing between UI/content script,
- durable extension-local state needed across page navigation,
- opening/focusing required media pages.

Avoid making the background script the sole owner of WebRTC media tracks if browser lifecycle behavior makes that unreliable; LiveKit connection belongs in a context capable of stable media permission/use.

## 4. Content script responsibilities

- inspect page for supported media,
- select appropriate media adapter,
- observe media state,
- apply remote playback state,
- emit normalized local playback actions,
- communicate with background/room UI using extension messaging.

Do not inject backend secrets or LiveKit secrets into page context.

## 5. UI responsibilities

Room UI includes:

- room code/share action,
- host badge,
- participant list,
- `everyone can control` toggle for host,
- leave/end room actions,
- transfer host/kick controls for host,
- LiveKit camera tiles,
- mic button,
- camera button,
- deafen/local audio control,
- ephemeral text chat,
- playback connection status,
- `Follow/Open media` action when media changes.

## 6. Media adapter interface

Recommended conceptual interface:

```ts
type MediaProvider = 'GENERIC' | 'YOUTUBE' | 'SPOTIFY'

interface MediaSnapshot {
  provider: MediaProvider
  mediaId: string | null
  url: string
  position: number
  paused: boolean
  playbackRate: number
  metadata?: { title?: string }
}

interface MediaAdapter {
  readonly provider: MediaProvider
  canHandle(): boolean | Promise<boolean>
  getSnapshot(): Promise<MediaSnapshot>
  play(): Promise<void>
  pause(): Promise<void>
  seek(position: number): Promise<void>
  setPlaybackRate(rate: number): Promise<void>
  subscribe(listener: (event: LocalMediaEvent) => void): () => void
}
```

Provider-specific capabilities may be exposed through a capability object instead of throwing for unsupported operations.

## 7. Generic HTML media adapter

Candidate detection:

1. find visible `<video>` and `<audio>` elements,
2. prefer active/playing element,
3. otherwise prefer largest visible video,
4. otherwise request user selection when multiple plausible candidates exist.

Observe:

- play,
- pause,
- seeking/seeked,
- ratechange,
- loadedmetadata,
- durationchange,
- ended,
- source changes where detectable.

## 8. YouTube adapter

Prefer robust integration with YouTube's actual player behavior instead of assuming the underlying HTML `<video>` element is always sufficient.

Normalize:

- current video ID,
- playlist context when available,
- position,
- play/pause,
- seek,
- playback rate,
- video change.

Keep YouTube-specific DOM/player probing isolated inside this adapter.

## 9. Spotify adapter

Spotify support is experimental.

Keep all Spotify-specific selectors/integration logic isolated.

Do not treat adapter errors as fatal to room/session communication.

Never attempt to extract/rebroadcast audio data.

## 10. Remote application suppression

When applying remote state, set an internal suppression context/token so native events created by the application are not republished as user control events.

## 11. State management

Use Zustand for extension UI/client state.

Suggested stores:

- auth store,
- room store,
- participant store,
- playback store,
- LiveKit/media store,
- ephemeral chat UI store.

Do not persist chat store to browser storage.

## 12. Browser storage

Allowed examples:

- non-sensitive UI preferences,
- active room ID if needed for recovery,
- adapter preferences,
- auth/session material only as required by Better Auth's safe integration design.

Never store:

- invite tokens beyond the immediate join operation,
- LiveKit API secret,
- chat history.
