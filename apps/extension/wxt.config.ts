import { defineConfig } from "wxt";

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
