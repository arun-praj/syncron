import { Button } from "@/components/Button";

const STEPS = [
  {
    title: "Open a streaming site",
    description: "Start playing a video on YouTube, Netflix, or any supported service in your browser.",
  },
  {
    title: "Reopen Syncron",
    description: "Click the extension icon again — it detects the video and lets you start or join a room.",
  },
  {
    title: "Invite your friends",
    description: "Share the room link. Everyone joins the same video, perfectly in sync.",
  },
  {
    title: "Watch and chat",
    description: "Play, pause, and seek together — plus voice or text chat right alongside the video.",
  },
];

export default function HowItWorksScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-shrink-0 items-center gap-2.5 border-b border-border px-[18px] py-3.5">
        <button
          type="button"
          aria-label="Back to home"
          onClick={onBack}
          className="flex h-[26px] w-[26px] items-center justify-center rounded-lg text-ink-label transition-colors hover:bg-neutral-100">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M15 18L9 12L15 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <span className="text-[14px] font-bold tracking-[-0.01em] text-ink-primary">
          How Syncron works
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-[22px]">
        <p className="mb-[22px] text-[12.5px] leading-relaxed tracking-[-0.005em] text-ink-secondary">
          A few steps to watch anything together, perfectly in sync.
        </p>

        <div className="flex flex-col gap-[18px]">
          {STEPS.map((step, i) => (
            <div key={step.title} className="flex gap-3.5">
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 text-[12.5px] font-bold text-accent">
                {i + 1}
              </div>
              <div>
                <h3 className="mb-1 text-[14px] font-semibold tracking-[-0.01em] text-ink-primary">
                  {step.title}
                </h3>
                <p className="text-[12.5px] leading-relaxed tracking-[-0.005em] text-ink-secondary">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-[26px] rounded-xl border border-border bg-neutral-50 p-3.5">
          <p className="text-[12px] leading-relaxed tracking-[-0.005em] text-neutral-600">
            <strong className="text-ink-primary">Tip:</strong> Everyone in the room needs to be
            logged into the same streaming service and have access to the video.
          </p>
        </div>
      </div>

      <div className="flex-shrink-0 px-5 pb-5 pt-4">
        <Button type="button" onClick={onBack}>
          Got it
        </Button>
      </div>
    </div>
  );
}
