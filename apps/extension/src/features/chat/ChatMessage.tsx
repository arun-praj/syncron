import type { MockMessage } from "@/lib/mock-data";

export function ChatMessage({
  message,
  authorName,
  isMe,
}: {
  message: MockMessage;
  authorName: string;
  isMe: boolean;
}) {
  return (
    <div className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-3 py-2 text-[13px] ${
          isMe ? "bg-accent text-white" : "bg-neutral-100 text-ink-primary"
        }`}>
        {!isMe && (
          <p className="mb-0.5 text-[10px] font-semibold text-ink-secondary">{authorName}</p>
        )}
        <p>{message.text}</p>
        <p className={`mt-1 text-[10px] ${isMe ? "text-blue-100" : "text-ink-placeholder"}`}>
          {message.timestamp}
        </p>
      </div>
    </div>
  );
}
