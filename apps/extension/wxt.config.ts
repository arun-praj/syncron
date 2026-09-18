import { defineConfig } from "wxt";

// Same origin as the API's GET /join page (docker-compose.yml maps the API
// container to host port 8000 in dev). Override via a WXT env file
// (WXT_APP_URL) for other environments — must match the API's APP_URL.
const APP_URL = process.env.WXT_APP_URL ?? "http://localhost:8000";

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Syncron",
    description:
      "Watch parties in sync — shared playback, live chat, and calls without leaving YouTube.",
    permissions: ["storage"],
    host_permissions: [
      "https://www.youtube.com/*",
      "https://www.spotify.com/*",
      "https://www.netflix.com/*",
    ],
    // Lets the API's GET /join page message this extension directly via
    // chrome.runtime.sendMessage(EXTENSION_ID, ...) so opening an invite
    // link can hand off to the extension with an explicit user click (see
    // background.ts's onMessageExternal listener) — deliberately not a
    // content script/host_permission, which would run our code on every
    // load of that origin instead of only when the page's own script
    // chooses to message us.
    externally_connectable: {
      matches: [`${APP_URL}/*`],
    },
    // Lets the YouTube in-page sidebar (a content script, subject to
    // youtube.com's own CSP) load these bundled images via
    // browser.runtime.getURL — avatars and reaction emoji, unlike the
    // YouTube brand icon, are too complex to just inline as SVG.
    web_accessible_resources: [
      {
        resources: ["static/avatars/*", "emoji/*"],
        matches: ["https://www.youtube.com/*"],
      },
    ],
  },
});
