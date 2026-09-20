import { useEffect, useMemo, useRef } from "react";
import { useChat } from "@livekit/components-react";
import { browser, type PublicPath } from "wxt/browser";

import { AvatarGlyph } from "@/components/AvatarGlyph";
import { SendIcon, SmileIcon } from "@/features/room/icons";
import { formatMemberLabel } from "@/features/room/member-label";
import { decodeReaction, encodeReaction, ROOM_REACTIONS } from "@/features/room/reactions";
import { useRoomStore } from "@/stores/room-store";

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const reactionPickerRef = useRef<HTMLDivElement>(null);
  const reactionToggleRef = useRef<HTMLButtonElement>(null);
  const chatOptions = useMemo(() => ({ room, channelTopic: "syncron.chat" }), [room]);
  const { chatMessages, isSending, send } = useChat(chatOptions);
  const systemMessages = useMemo(() => allMessages.filter((message) => message.kind === "system"), [allMessages]);

  const seenReactionIds = useRef(new Set<string>());
  useEffect(() => {
    for (const message of chatMessages) {
      const reaction = decodeReaction(message.message);
      if (!reaction || seenReactionIds.current.has(message.id)) continue;
      seenReactionIds.current.add(message.id);
      sendReaction(reaction, message.id);
    }
  }, [chatMessages, sendReaction]);

  const messages = useMemo(
    () => [
      ...systemMessages.map((message) => ({
        ...message,
        isSelf: false,
        timestamp: Number(message.id.slice(7).split("-")[0]) || 0,
      })),
      ...chatMessages.filter((message) => !decodeReaction(message.message)).map((message) => {
        const senderId = message.from?.identity;
        const sender = members.find((member) => member.id === senderId);
        return {
          id: message.id,
          kind: "chat" as const,
          authorName: formatMemberLabel(
            sender ?? (senderId !== undefined && senderId === selfUserId ? { id: senderId, name: "" } : null),
            selfUserId,
          ),
          avatarId: sender?.avatarId ?? "1",
          time: formatChatTime(message.timestamp),
          text: message.message,
          timestamp: message.timestamp,
          isSelf: senderId === selfUserId,
        };
      }),
    ].sort((a, b) => a.timestamp - b.timestamp),
    [chatMessages, members, selfUserId, systemMessages],
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  useEffect(() => {
    if (!showReactionPicker) return;

    const handlePointerDown = (event: PointerEvent) => {
      const path = event.composedPath();
      if (reactionPickerRef.current && path.includes(reactionPickerRef.current)) return;
      if (reactionToggleRef.current && path.includes(reactionToggleRef.current)) return;
      toggleReactionPicker();
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [showReactionPicker, toggleReactionPicker]);

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
      <div ref={scrollRef} className="chat-scroll">
        {messages.map((message) =>
          message.kind === "system" ? (
            <div key={message.id} className="system-msg">
              <span className="system-dot" />
              <span className="system-text">{message.text}</span>
              <span className="system-dot" />
            </div>
          ) : (
            <div key={message.id} className={`chat-msg${message.isSelf ? " chat-msg-self" : ""}`}>
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
          <div ref={reactionPickerRef} className="reaction-picker">
            {ROOM_REACTIONS.map((reaction) => (
              <button
                key={reaction.id}
                type="button"
                onClick={() => {
                  void send(encodeReaction(reaction))
                    .then((message) => sendReaction(reaction, message.id))
                    .catch((error) => console.error("[Syncron] LiveKit reaction send failed", error));
                }}
                aria-label={reaction.label}
                title={reaction.label}>
                <img src={reactionIconSrc(reaction.icon)} alt="" />
              </button>
            ))}
          </div>
        )}
        <button
          ref={reactionToggleRef}
          type="button"
          onClick={toggleReactionPicker}
          aria-label="React"
          aria-expanded={showReactionPicker}
          className="react-toggle">
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
