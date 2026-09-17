import { useEffect, useState } from "react";
import { browser } from "wxt/browser";

import { findStreamingServiceByOrigin, type StreamingService } from "@/lib/streaming-services";

export interface DetectedStreamingTab {
  service: StreamingService;
  tabId: number;
  title: string;
  url: string;
}

// `tabs.query` only returns `url`/`title` for tabs matching this
// extension's host permissions, so non-supported tabs (and any tab, if the
// permission is ever missing) simply resolve to `null` here rather than
// throwing.
async function detectActiveTab(): Promise<DetectedStreamingTab | null> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab?.id === undefined || !tab.url) return null;

  let origin: string;
  try {
    origin = new URL(tab.url).origin;
  } catch {
    return null;
  }

  const service = findStreamingServiceByOrigin(origin);
  if (!service) return null;

  return { service, tabId: tab.id, title: tab.title?.trim() || service.name, url: tab.url };
}

// Tracks which supported streaming service (if any) is open in the active
// tab of the current window, so the popup/side panel can swap Home for
// party setup and stay in sync as the user switches or navigates tabs.
export function useDetectedStreamingTab(): DetectedStreamingTab | null | "loading" {
  const [detected, setDetected] = useState<DetectedStreamingTab | null | "loading">("loading");

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      void detectActiveTab().then((result) => {
        if (!cancelled) setDetected(result);
      });
    };

    refresh();
    browser.tabs.onActivated.addListener(refresh);
    browser.tabs.onUpdated.addListener(refresh);
    return () => {
      cancelled = true;
      browser.tabs.onActivated.removeListener(refresh);
      browser.tabs.onUpdated.removeListener(refresh);
    };
  }, []);

  return detected;
}
