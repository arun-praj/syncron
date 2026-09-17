export default defineBackground(() => {
  // Session state lives in chrome.storage.local (see
  // src/services/browser-token-storage.ts) so popup and content-script
  // contexts can all read it directly without round-tripping through the
  // background worker. This entrypoint currently only owns extension
  // lifecycle logging; message routing for room/LiveKit coordination is
  // future work (see docs/extension-architecture.md §3), out of scope for
  // this auth-focused pass.
  browser.runtime.onInstalled.addListener(() => {
    console.log("[Syncron] background service worker ready");
  });
});
