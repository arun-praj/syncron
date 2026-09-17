const SERVICE_ORIGINS = new Set([
  "https://www.youtube.com",
  "https://www.spotify.com",
  "https://www.netflix.com",
]);

export default defineBackground(() => {
  // Keep the manifest's side-panel entrypoint disabled globally. The popup
  // enables it only for the service tab it creates.
  void browser.sidePanel.setOptions({ enabled: false });

  browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (!changeInfo.url) return;

    let origin = "";
    try {
      origin = new URL(changeInfo.url).origin;
    } catch {
      // Ignore non-http extension/browser URLs.
    }

    if (!SERVICE_ORIGINS.has(origin)) {
      void browser.sidePanel.setOptions({ tabId, enabled: false });
    }
  });

  // Session state lives in chrome.storage.local (see
  // src/services/browser-token-storage.ts) so popup and content-script
  // contexts can all read it directly without round-tripping through the
  // background worker. This entrypoint currently only owns extension
  // lifecycle logging; message routing for room/LiveKit coordination is
  // future work (see docs/extension-architecture.md §3), out of scope for
  // this auth-focused pass. The side-panel scoping above is the only
  // background behavior needed by the current popup flow.
  browser.runtime.onInstalled.addListener(() => {
    console.log("[Syncron] background service worker ready");
  });
});
