import { useRef, useState, type RefObject } from "react";

import { ClipboardIcon } from "@/features/room/icons";
import { useRoomStore } from "@/stores/room-store";

export function InviteHintOverlay({ targetRef }: { targetRef: RefObject<HTMLElement | null> }) {
  const inviteUrl = useRoomStore((s) => s.identity?.inviteUrl ?? "");
  const copyLabel = useRoomStore((s) => s.copyLabel);
  const copyInvite = useRoomStore((s) => s.copyInvite);
  const dismissInviteHint = useRoomStore((s) => s.dismissInviteHint);

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
    setTimeout(dismissInviteHint, 280);
  };

  return (
    <div className="hint-overlay" style={{ opacity: closing ? 0 : 1 }}>
      <div ref={cardRef} className="hint-card" style={cardStyle}>
        <div className="hint-icon">
          <ClipboardIcon width={20} height={20} color="#2563eb" />
        </div>
        <h3 className="hint-title">Invite your friends</h3>
        <div className="hint-link-row">
          <div className="hint-link">{inviteUrl}</div>
          <button type="button" onClick={() => void copyInvite()} aria-label={copyLabel} title={copyLabel} className="hint-copy-btn">
            <ClipboardIcon color="#fff" />
          </button>
        </div>
        <button type="button" onClick={close} className="hint-close">
          Close
        </button>
      </div>
    </div>
  );
}
