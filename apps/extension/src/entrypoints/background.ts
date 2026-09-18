import { STREAMING_SERVICES } from "@/lib/streaming-services";

const SERVICE_ORIGINS = new Set(STREAMING_SERVICES.map((service) => service.origin));
const DEFAULT_POPUP = "popup.html";

function originOf(url: string | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

// Side panels can only be opened programmatically from inside a user
// gesture, so there's no API to pop it open unprompted the moment a
// supported tab loads. Instead: clear the per-tab popup on supported tabs
// (paired with openPanelOnActionClick below) so clicking the toolbar icon
// there opens the side panel directly instead of the popup; every other
// tab keeps the normal popup.
async function syncTabActionSurface(tabId: number, url: string | undefined) {
  const supported = SERVICE_ORIGINS.has(originOf(url));
  await Promise.all([
    supported
      ? browser.sidePanel.setOptions({ tabId, path: "sidepanel.html", enabled: true })
      : Promise.resolve(),
    browser.action.setPopup({ tabId, popup: supported ? "" : DEFAULT_POPUP }),
  ]);
}

export default defineBackground(() => {
  void browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

  // Keep the panel enabled while tabs change. Disabling it on an unsupported
  // tab closes an already-open panel, and Edge will not reopen it when the
  // user returns to the supported tab without another gesture.
  void browser.sidePanel.setOptions({ path: "sidepanel.html", enabled: true });

  // The service worker's top-level code reruns on every startup (install,
  // browser relaunch, or waking for an event), so re-check every open tab
  // each time rather than only reacting to future navigations — otherwise
  // a tab already sitting on a supported site when the extension
  // installs/reloads would be stuck without a side panel until it
  // happened to navigate again.
  void browser.tabs.query({}).then((tabs) => {
    for (const tab of tabs) {
      if (tab.id !== undefined) void syncTabActionSurface(tab.id, tab.url);
    }
  });

  browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (!changeInfo.url) return;
    void syncTabActionSurface(tabId, tab.url);
  });

  // Session state lives in chrome.storage.local (see
  // src/services/auth/client.ts) so popup and content-script contexts can
  // all read it directly without round-tripping through the background
  // worker. This entrypoint currently only owns extension lifecycle
  // logging; message routing for room/LiveKit coordination is future work
  // (see docs/extension-architecture.md §3), out of scope for this
  // auth-focused pass. The side-panel/action scoping above is the only
  // other background behavior needed by the current popup flow.
  browser.runtime.onInstalled.addListener(() => {
    console.log("[Syncron] background service worker ready");
  });
});
