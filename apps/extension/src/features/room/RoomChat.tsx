import { useEffect, useRef, useState } from "react";
import { browser, type PublicPath } from "wxt/browser";

import { AvatarGlyph } from "@/components/AvatarGlyph";
import { SendIcon, SmileIcon } from "@/features/room/room-icons";
import {
  ROOM_MOCK_MESSAGES,
  ROOM_REACTIONS,
  type RoomChatMessage,
  type RoomReaction,
} from "@/features/room/room-mock-data";

// Same reasoning as AvatarGlyph.avatarGlyphSrc: this renders inside the
// YouTube in-page sidebar, where a plain relative src resolves against
// youtube.com's origin instead of the extension's.
function reactionIconSrc(icon: string): string {
  return browser.runtime.getURL(icon as PublicPath);
}

interface FloatingReaction {
  id: string;
  reaction: RoomReaction;
  left: number;
}

export function RoomChat() {
  const [messages, setMessages] = useState<RoomChatMessage[]>(ROOM_MOCK_MESSAGES);
  const [draft, setDraft] = useState("");
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [floating, setFloating] = useState<FloatingReaction[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    setMessages((prev) => [
      ...prev,
      { id: `local-${Date.now()}`, kind: "chat", authorName: "You", avatarId: "1", time: "Now", text },
    ]);
    setDraft("");
  };

  const sendReaction = (reaction: RoomReaction) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setFloating((prev) => [...prev, { id, reaction, left: 15 + Math.random() * 60 }]);
    setShowReactionPicker(false);
    setTimeout(() => setFloating((prev) => prev.filter((r) => r.id !== id)), 1800);
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="pointer-events-none absolute inset-x-0 bottom-[70px] z-20">
        {floating.map((r) => (
          <img
            key={r.id}
            src={reactionIconSrc(r.reaction.icon)}
            alt={r.reaction.label}
            className="absolute bottom-0 h-7 w-7 animate-[room-reaction-float_1.8s_ease-out_forwards]"
            style={{ left: `${r.left}%` }}
          />
        ))}
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-[18px] py-3">
        <div className="flex flex-col gap-2.5">
          {messages.map((msg) =>
            msg.kind === "system" ? (
              <div key={msg.id} className="flex items-center justify-center gap-1.5 py-0.5">
                <span className="h-[3px] w-[3px] flex-shrink-0 rounded-full bg-neutral-300" />
                <span className="text-center text-[11px] italic text-ink-placeholder">{msg.text}</span>
                <span className="h-[3px] w-[3px] flex-shrink-0 rounded-full bg-neutral-300" />
              </div>
            ) : (
              <div key={msg.id} className="flex items-start gap-2">
                {msg.avatarId && (
                  <AvatarGlyph avatarId={msg.avatarId} className="mt-0.5 h-6 w-6 flex-shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[12px] font-semibold text-ink-primary">{msg.authorName}</span>
                    <span className="text-[10.5px] text-ink-placeholder">{msg.time}</span>
                  </div>
                  <p className="mt-0.5 text-[12.5px] leading-snug text-ink-label">{msg.text}</p>
                </div>
              </div>
            ),
          )}
        </div>
      </div>

      <div className="relative flex flex-shrink-0 items-center gap-2 border-t border-border px-[18px] py-3">
        {showReactionPicker && (
          <div className="absolute bottom-[calc(100%_+_6px)] left-[18px] right-[18px] flex items-center gap-1 rounded-[20px] border border-border bg-white p-1.5 shadow-[0_4px_14px_rgba(0,0,0,0.1)]">
            {ROOM_REACTIONS.map((reaction) => (
              <button
                key={reaction.id}
                type="button"
                onClick={() => sendReaction(reaction)}
                aria-label={reaction.label}
                title={reaction.label}
                className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full p-1 transition-colors hover:bg-neutral-50">
                <img src={reactionIconSrc(reaction.icon)} alt="" className="h-full w-full object-contain" />
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => setShowReactionPicker((v) => !v)}
          aria-label="React"
          className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[9px] border border-border-input bg-white text-ink-label transition-colors hover:bg-neutral-50">
          <SmileIcon className="h-4 w-4" />
        </button>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
          placeholder="Send a message"
          className="min-w-0 flex-1 rounded-[9px] border border-border-input px-3 py-[9px] text-[12.5px] text-ink-primary outline-none focus:border-blue-300"
        />
        <button
          type="button"
          onClick={send}
          aria-label="Send message"
          className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[9px] bg-gradient-to-b from-brand-top to-brand-bottom text-white shadow-btn-primary">
          <SendIcon className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
