import { useEffect, useRef } from "react";
import { browser, type PublicPath } from "wxt/browser";

import { AvatarGlyph } from "@/components/AvatarGlyph";
import { SendIcon, SmileIcon } from "@/features/room/icons";
import { ROOM_REACTIONS, useRoomStore } from "@/stores/room-store";

// Same reasoning as AvatarGlyph.avatarGlyphSrc: this renders inside the
// YouTube in-page sidebar, where a plain relative src resolves against
// youtube.com's origin instead of the extension's.
function reactionIconSrc(icon: string): string {
  return browser.runtime.getURL(icon as PublicPath);
}

export function RoomChat() {
  const messages = useRoomStore((s) => s.messages);
  const draft = useRoomStore((s) => s.draft);
  const setDraft = useRoomStore((s) => s.setDraft);
  const sendMessage = useRoomStore((s) => s.sendMessage);
  const isPeerTyping = useRoomStore((s) => s.isPeerTyping);
  const showReactionPicker = useRoomStore((s) => s.showReactionPicker);
  const toggleReactionPicker = useRoomStore((s) => s.toggleReactionPicker);
  const sendReaction = useRoomStore((s) => s.sendReaction);
  const floatingReactions = useRoomStore((s) => s.floatingReactions);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  return (
    <div className="chat-area">
      {floatingReactions.map((r) => (
        <img
          key={r.id}
          src={reactionIconSrc(r.icon)}
          alt=""
          className="float-reaction"
          style={{ left: `${r.left}%` }}
        />
      ))}

      <div ref={scrollRef} className="chat-scroll">
        {messages.map((msg) =>
          msg.kind === "system" ? (
            <div key={msg.id} className="system-msg">
              <span className="system-dot" />
              <span className="system-text">{msg.text}</span>
              <span className="system-dot" />
            </div>
          ) : (
            <div key={msg.id} className="chat-msg">
              {msg.avatarId && <AvatarGlyph avatarId={msg.avatarId} className="chat-avatar" />}
              <div className="chat-body">
                <div className="chat-meta">
                  <span className="chat-name">{msg.authorName}</span>
                  <span className="chat-time">{msg.time}</span>
                </div>
                <p className="chat-text">{msg.text}</p>
              </div>
            </div>
          ),
        )}
      </div>

      {isPeerTyping && (
        <div className="typing">
          <span>Alex is typing…</span>
        </div>
      )}

      <div className="composer">
        {showReactionPicker && (
          <div className="reaction-picker">
            {ROOM_REACTIONS.map((reaction) => (
              <button
                key={reaction.id}
                type="button"
                onClick={() => sendReaction(reaction)}
                aria-label={reaction.label}
                title={reaction.label}>
                <img src={reactionIconSrc(reaction.icon)} alt="" />
              </button>
            ))}
          </div>
        )}
        <button type="button" onClick={toggleReactionPicker} aria-label="React" className="react-toggle">
          <SmileIcon />
        </button>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") sendMessage();
          }}
          placeholder="Send a message"
          className="msg-input"
        />
        <button type="button" onClick={sendMessage} aria-label="Send message" className="send-btn">
          <SendIcon />
        </button>
      </div>
    </div>
  );
}
