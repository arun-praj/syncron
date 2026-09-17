import { useState } from "react";

import { CallControls } from "@/features/call/CallControls";
import { ParticipantTile } from "@/features/call/ParticipantTile";
import { mockParticipants } from "@/lib/mock-data";

export function CallOverlay() {
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [ended, setEnded] = useState(false);

  if (ended) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-btn font-semibold text-ink-primary">Call ended</p>
        <p className="text-[12px] text-ink-secondary">
          You can start a new call anytime from the popup.
        </p>
        <button
          type="button"
          onClick={() => setEnded(false)}
          className="mt-2 text-[12px] font-semibold text-accent hover:underline">
          Rejoin call
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="text-btn font-semibold text-ink-primary">Watch party call</p>
        <span className="flex items-center gap-1.5 text-[11px] text-green-700">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
          Live
        </span>
      </div>

      <div className="grid flex-1 grid-cols-2 gap-2 overflow-y-auto p-3">
        {mockParticipants.map((p, i) => (
          <ParticipantTile
            key={p.id}
            user={p}
            isSpeaking={i === 1}
            mediaOff={i === 0 && cameraOff}
          />
        ))}
      </div>

      <CallControls
        muted={muted}
        cameraOff={cameraOff}
        onToggleMute={() => setMuted((m) => !m)}
        onToggleCamera={() => setCameraOff((c) => !c)}
        onEndCall={() => setEnded(true)}
      />
    </div>
  );
}
