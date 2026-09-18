import { useEffect, useState } from "react";
import { browser } from "wxt/browser";

import { GET_PLAYBACK_SNAPSHOT, type PlaybackSnapshot } from "@/lib/playback-messages";

const POLL_INTERVAL_MS = 1000;
type SnapshotReader = () => Promise<PlaybackSnapshot | null>;

// Only the YouTube content script answers this message today (see
// docs/extension-architecture.md — Spotify/Netflix adapters aren't built
// yet), and only on /watch pages. Any tab without a listener (wrong page,
// content script not yet injected) just resolves to `null`, which callers
// should treat as "no live position available".
export function usePlaybackSnapshot(tabId: number | null, localReader?: SnapshotReader): PlaybackSnapshot | null {
  const [snapshot, setSnapshot] = useState<PlaybackSnapshot | null>(null);

  useEffect(() => {
    if (tabId === null) {
      setSnapshot(null);
      return;
    }

    let cancelled = false;
    const poll = () => {
      const request = localReader
        ? localReader()
        : browser.tabs.sendMessage(tabId, { type: GET_PLAYBACK_SNAPSHOT });
      void request
        .then((result) => {
          if (!cancelled) setSnapshot((result as PlaybackSnapshot | null | undefined) ?? null);
        })
        .catch(() => {
          if (!cancelled) setSnapshot(null);
        });
    };

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [localReader, tabId]);

  return snapshot;
}
