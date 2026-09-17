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
    host_permissions: ["https://www.youtube.com/*"],
  },
});
