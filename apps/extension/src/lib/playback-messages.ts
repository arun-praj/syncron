// Internal message contract between the YouTube content script and the
// popup/side panel, used only to ask "what's playing on this tab right
// now" for display purposes. This never crosses the network, so it has no
// place in packages/protocol — that's reserved for API/WebSocket
// contracts shared between the server and the extension.
export const GET_PLAYBACK_SNAPSHOT = "syncron:get-playback-snapshot" as const;

export interface PlaybackSnapshotRequest {
  type: typeof GET_PLAYBACK_SNAPSHOT;
}

export interface PlaybackSnapshot {
  title: string;
  currentTime: number;
  duration: number;
  paused: boolean;
  playbackRate: number;
  muted: boolean;
  volume: number;
}

export function isPlaybackSnapshotRequest(message: unknown): message is PlaybackSnapshotRequest {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as { type?: unknown }).type === GET_PLAYBACK_SNAPSHOT
  );
}
