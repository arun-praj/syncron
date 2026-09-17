import cssText from "data-text:~style.css"
import { useState } from "react"

import type { PlasmoCSConfig } from "plasmo"

import { CallOverlay } from "~common/features/call/CallOverlay"
import { ChatPanel } from "~common/features/chat/ChatPanel"

export const config: PlasmoCSConfig = {
  matches: ["https://www.youtube.com/watch*"]
}

// Injects Tailwind's compiled CSS into the Shadow DOM Plasmo mounts this
// content-script UI into, so it never collides with (or leaks into)
// YouTube's own page styles.
export const getStyle = () => {
  const style = document.createElement("style")
  style.textContent = cssText
  return style
}

type Tab = "chat" | "call"

function SyncronOverlay() {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>("chat")

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-[2147483647] flex items-center gap-2 rounded-full bg-gradient-to-b from-brand-top to-brand-bottom px-4 py-3 font-sans text-btn font-semibold text-white shadow-btn-primary hover:shadow-btn-primary-hover">
        Syncron
      </button>
    )
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
  )
}

export default SyncronOverlay
