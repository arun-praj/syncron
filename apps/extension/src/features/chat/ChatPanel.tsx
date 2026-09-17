import { useState } from "react";

import { ChatMessage } from "@/src/features/chat/ChatMessage";
import {
  mockCurrentUser,
  mockMessages,
  mockParticipants,
  type MockMessage,
} from "@/src/lib/mock-data";

export function ChatPanel() {
  const [messages, setMessages] = useState<MockMessage[]>(mockMessages);
  const [draft, setDraft] = useState("");
  const [isTyping] = useState(true);

  const participantName = (id: string) =>
    mockParticipants.find((p) => p.id === id)?.name ?? "Unknown";

  const send = () => {
    if (!draft.trim()) return;
    setMessages((prev) => [
      ...prev,
      {
        id: `local-${Date.now()}`,
        authorId: mockCurrentUser.id,
        text: draft.trim(),
        timestamp: "now",
      },
    ]);
    setDraft("");
  };

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="text-btn font-semibold text-ink-primary">Watch party chat</p>
        <span className="text-[11px] text-ink-secondary">{mockParticipants.length} online</span>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {messages.map((m) => (
          <ChatMessage
            key={m.id}
            message={m}
            authorName={participantName(m.authorId)}
            isMe={m.authorId === mockCurrentUser.id}
          />
        ))}
        {isTyping && (
          <p className="text-[11px] italic text-ink-placeholder">Priya is typing…</p>
        )}
      </div>

      <form
        className="flex items-center gap-2 border-t border-border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Send a message"
          className="flex-1 rounded-input border border-border-input bg-white px-3 py-2 text-input text-ink-primary outline-none focus:border-ink-primary focus:shadow-focus"
        />
        <button
          type="submit"
          className="rounded-btn bg-gradient-to-b from-brand-top to-brand-bottom px-3 py-2 text-btn font-semibold text-white shadow-btn-primary hover:shadow-btn-primary-hover">
          Send
        </button>
      </form>
    </div>
  );
}
