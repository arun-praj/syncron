import { fileURLToPath } from "node:url";
import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";

// packages/protocol and packages/validation live outside this app's
// directory (monorepo-shared Zod contracts — see CLAUDE.md: "do not
// duplicate protocol types"). Vite's dev server blocks reading files
// outside the project root by default, so the workspace root must be
// explicitly allowed.
const workspaceRoot = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig({
  modules: ["@wxt-dev/module-react", "@wxt-dev/auto-icons"],
  srcDir: ".",
  manifest: {
    name: "Syncron",
    description:
      "Watch parties in sync — shared playback, live chat, and calls without leaving YouTube.",
    permissions: ["storage", "tabs", "sidePanel"],
    host_permissions: ["https://www.youtube.com/*"],
    side_panel: { default_path: "sidepanel.html" },
  },
  vite: () => ({
    plugins: [tailwindcss()],
    server: {
      fs: { allow: [workspaceRoot] },
    },
  }),
});
