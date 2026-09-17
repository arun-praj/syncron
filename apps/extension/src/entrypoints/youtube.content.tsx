import { createRoot, type Root } from "react-dom/client";
import { useState } from "react";

import { CallOverlay } from "@/features/call/CallOverlay";
import { ChatPanel } from "@/features/chat/ChatPanel";

import "@/style.css";

type Tab = "chat" | "call";

function SyncronOverlay() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("chat");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-[2147483647] flex items-center gap-2 rounded-full bg-gradient-to-b from-brand-top to-brand-bottom px-4 py-3 font-sans text-btn font-semibold text-white shadow-btn-primary hover:shadow-btn-primary-hover">
        Syncron
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-[2147483647] flex h-[520px] w-[340px] flex-col overflow-hidden rounded-card border border-border bg-white font-sans shadow-card">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex gap-1 rounded-full bg-neutral-100 p-1">
          <button
            type="button"
            onClick={() => setTab("chat")}
            className={`rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
              tab === "chat" ? "bg-white text-ink-primary shadow-sm" : "text-ink-secondary"
            }`}>
            Chat
          </button>
          <button
            type="button"
            onClick={() => setTab("call")}
            className={`rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
              tab === "call" ? "bg-white text-ink-primary shadow-sm" : "text-ink-secondary"
            }`}>
            Call
          </button>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-1 text-ink-secondary hover:text-ink-primary"
          aria-label="Close">
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-hidden">{tab === "chat" ? <ChatPanel /> : <CallOverlay />}</div>
    </div>
  );
}

export default defineContentScript({
  matches: ["https://www.youtube.com/watch*"],
  cssInjectionMode: "ui",
  async main(ctx) {
    const ui = await createShadowRootUi(ctx, {
      name: "syncron-overlay",
      position: "inline",
      anchor: "body",
      onMount(container): Root {
        const root = createRoot(container);
        root.render(<SyncronOverlay />);
        return root;
      },
      onRemove(root) {
        root?.unmount();
      },
    });
    ui.mount();
  },
});
