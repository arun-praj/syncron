import { useEffect, useMemo, useRef } from "react";
import { useChat } from "@livekit/components-react";
import { browser, type PublicPath } from "wxt/browser";

import { AvatarGlyph } from "@/components/AvatarGlyph";
import { SendIcon, SmileIcon } from "@/features/room/icons";
import { ROOM_REACTIONS, useRoomStore } from "@/stores/room-store";

function reactionIconSrc(icon: string): string {
  return browser.runtime.getURL(icon as PublicPath);
}

function formatChatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function RoomChat() {
  const room = useRoomStore((s) => s.liveKit?.currentRoom);
  const selfUserId = useRoomStore((s) => s.identity?.selfUserId);
  const members = useRoomStore((s) => s.members);
  const allMessages = useRoomStore((s) => s.messages);
  const draft = useRoomStore((s) => s.draft);
  const setDraft = useRoomStore((s) => s.setDraft);
  const isPeerTyping = useRoomStore((s) => s.isPeerTyping);
  const showReactionPicker = useRoomStore((s) => s.showReactionPicker);
  const toggleReactionPicker = useRoomStore((s) => s.toggleReactionPicker);
  const sendReaction = useRoomStore((s) => s.sendReaction);
  const floatingReactions = useRoomStore((s) => s.floatingReactions);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chatOptions = useMemo(() => ({ room, channelTopic: "syncron.chat" }), [room]);
  const { chatMessages, isSending, send } = useChat(chatOptions);
  const systemMessages = useMemo(() => allMessages.filter((message) => message.kind === "system"), [allMessages]);

  const messages = useMemo(
    () => [
      ...systemMessages.map((message) => ({
        ...message,
        timestamp: Number(message.id.slice(7).split("-")[0]) || 0,
      })),
      ...chatMessages.map((message) => {
        const senderId = message.from?.identity;
        const sender = members.find((member) => member.id === senderId);
        return {
          id: message.id,
          kind: "chat" as const,
          authorName: senderId === selfUserId ? "You" : (sender?.name ?? "Someone"),
          avatarId: sender?.avatarId ?? "1",
          time: formatChatTime(message.timestamp),
          text: message.message,
          timestamp: message.timestamp,
        };
      }),
    ].sort((a, b) => a.timestamp - b.timestamp),
    [chatMessages, members, selfUserId, systemMessages],
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  const sendMessage = async () => {
    const text = draft.trim();
    if (!text || !room || isSending) return;
    setDraft("");
    try {
      await send(text);
    } catch (error) {
      setDraft(text);
      console.error("[Syncron] LiveKit chat send failed", error);
    }
  };

  return (
    <div className="chat-area">
      {floatingReactions.map((reaction) => (
        <img
          key={reaction.id}
          src={reactionIconSrc(reaction.icon)}
          alt=""
          className="float-reaction"
          style={{ left: `${reaction.left}%` }}
        />
      ))}

      <div ref={scrollRef} className="chat-scroll">
        {messages.map((message) =>
          message.kind === "system" ? (
            <div key={message.id} className="system-msg">
              <span className="system-dot" />
              <span className="system-text">{message.text}</span>
              <span className="system-dot" />
            </div>
          ) : (
            <div key={message.id} className="chat-msg">
              {message.avatarId && <AvatarGlyph avatarId={message.avatarId} className="chat-avatar" />}
              <div className="chat-body">
                <div className="chat-meta">
                  <span className="chat-name">{message.authorName}</span>
                  <span className="chat-time">{message.time}</span>
                </div>
                <p className="chat-text">{message.text}</p>
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
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            // Keep YouTube's document-level shortcuts from seeing chat input
            // (Space pauses, M mutes, etc.).
            event.stopPropagation();
            if (event.key === "Enter") void sendMessage();
          }}
          onKeyUp={(event) => event.stopPropagation()}
          placeholder="Send a message"
          className="msg-input"
        />
        <button
          type="button"
          onClick={() => void sendMessage()}
          aria-label="Send message"
          className="send-btn"
          disabled={isSending}>
          <SendIcon />
        </button>
      </div>
    </div>
  );
}
