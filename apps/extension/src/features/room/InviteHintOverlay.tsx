import { useRef, useState, type RefObject } from "react";

import { ClipboardIcon } from "@/features/room/room-icons";

export function InviteHintOverlay({
  inviteUrl,
  copyLabel,
  targetRef,
  onCopy,
  onClose,
}: {
  inviteUrl: string;
  copyLabel: string;
  targetRef: RefObject<HTMLElement | null>;
  onCopy: () => void;
  onClose: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [closing, setClosing] = useState(false);
  const [cardStyle, setCardStyle] = useState<{ transform: string; opacity: number }>({
    transform: "scale(1)",
    opacity: 1,
  });

  const close = () => {
    const target = targetRef.current;
    const card = cardRef.current;
    if (target && card) {
      const t = target.getBoundingClientRect();
      const c = card.getBoundingClientRect();
      const dx = t.left + t.width / 2 - (c.left + c.width / 2);
      const dy = t.top + t.height / 2 - (c.top + c.height / 2);
      setCardStyle({ transform: `translate(${dx}px, ${dy}px) scale(0.05)`, opacity: 0 });
    } else {
      setCardStyle({ transform: "scale(0.05)", opacity: 0 });
    }
    setClosing(true);
    setTimeout(onClose, 280);
  };

  return (
    <div
      className="absolute inset-0 z-10 flex items-center justify-center bg-[rgba(10,10,10,0.45)] transition-opacity duration-[280ms]"
      style={{ opacity: closing ? 0 : 1 }}>
      <div
        ref={cardRef}
        className="w-[280px] rounded-card bg-white px-5 py-[22px] text-center shadow-[0_20px_40px_rgba(0,0,0,0.25)] transition-[transform,opacity] duration-[280ms] ease-standard"
        style={cardStyle}>
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-blue-50">
          <ClipboardIcon className="h-5 w-5 text-accent" />
        </div>
        <h3 className="mb-3.5 text-[14.5px] font-bold tracking-[-0.01em] text-ink-primary">
          Invite your friends
        </h3>
        <div className="mb-2.5 flex items-center gap-2">
          <div className="min-w-0 flex-1 truncate rounded-lg border border-border bg-neutral-50 px-2.5 py-2 text-left text-[12px] text-ink-label">
            {inviteUrl}
          </div>
          <button
            type="button"
            onClick={onCopy}
            aria-label={copyLabel}
            title={copyLabel}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-b from-brand-top to-brand-bottom text-white shadow-btn-primary">
            <ClipboardIcon className="h-4 w-4" />
          </button>
        </div>
        <button
          type="button"
          onClick={close}
          className="w-full rounded-lg border border-border-input bg-white py-2 text-[12.5px] font-semibold text-ink-label transition-colors hover:bg-neutral-50">
          Close
        </button>
      </div>
    </div>
  );
}
