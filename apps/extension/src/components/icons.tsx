// Minimal stroke-based icon set (Inter/"Simplistic SaaS" aesthetic — no
// external icon library dependency yet). Swap for a proper icon set
// (e.g. lucide-react) once the design is signed off.

export const GoogleIcon = () => (
  <svg width="15" height="15" viewBox="0 0 48 48">
    <path
      fill="#FFC107"
      d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8.1 3.1l6-6C34.5 6 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"
    />
    <path
      fill="#FF3D00"
      d="M6.3 14.7l6.6 4.8C14.6 16 18.9 12 24 12c3.1 0 5.9 1.2 8.1 3.1l6-6C34.5 6 29.6 4 24 4c-7.7 0-14.3 4.4-17.7 10.7z"
    />
    <path
      fill="#4CAF50"
      d="M24 44c5.5 0 10.4-1.8 14.2-4.9l-6.6-5.6C29.5 35.4 26.9 36 24 36c-5.3 0-9.7-3.1-11.3-7.6l-6.6 5.1C9.6 39.5 16.2 44 24 44z"
    />
    <path
      fill="#1976D2"
      d="M43.6 20.5H42V20H24v8h11.3c-1 3-3.1 5.4-5.7 6.9l6.6 5.6C39.9 37.2 44 31.5 44 24c0-1.3-.1-2.7-.4-3.5z"
    />
  </svg>
);

const strokeProps = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const MicIcon = () => (
  <svg {...strokeProps}>
    <rect x="9" y="2" width="6" height="11" rx="3" />
    <path d="M5 10v1a7 7 0 0014 0v-1" />
    <path d="M12 18v3" />
  </svg>
);

export const MicOffIcon = () => (
  <svg {...strokeProps}>
    <path d="M9 5a3 3 0 016 0v6c0 .35-.04.69-.12 1.01M15 15.5A3 3 0 019 13v-2" />
    <path d="M5 10v1a7 7 0 0010.24 6.22M19 11v0" />
    <path d="M12 18v3" />
    <path d="M3 3l18 18" />
  </svg>
);

export const VideoIcon = () => (
  <svg {...strokeProps}>
    <rect x="2" y="6" width="14" height="12" rx="2" />
    <path d="M16 10l6-3v10l-6-3" />
  </svg>
);

export const VideoOffIcon = () => (
  <svg {...strokeProps}>
    <path d="M16 10l6-3v10l-6-3" />
    <path d="M2 8v10a2 2 0 002 2h9" />
    <path d="M2 6a2 2 0 012-2h5" />
    <path d="M3 3l18 18" />
  </svg>
);

export const ScreenShareIcon = () => (
  <svg {...strokeProps}>
    <rect x="2" y="4" width="20" height="13" rx="2" />
    <path d="M8 21h8M12 17v4" />
  </svg>
);

export const PhoneOffIcon = () => (
  <svg {...strokeProps}>
    <path d="M6 8a15 15 0 0012 8l1.5-1.5a2 2 0 00.4-2.2l-1-2a2 2 0 00-1.9-1.2h-.5" />
    <path d="M10.5 8.5a12 12 0 003.6 3.7" />
    <path d="M3 3l18 18" />
  </svg>
);

export const PencilIcon = ({ className }: { className?: string }) => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    className={className}>
    <path
      d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const CheckIcon = ({ className }: { className?: string }) => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    className={className}>
    <path
      d="M20 6L9 17l-5-5"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const ChevronLeftIcon = ({ className }: { className?: string }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    className={className}>
    <path
      d="M15 18L9 12L15 6"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const PeopleIcon = ({ className }: { className?: string }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className={className}>
    <circle cx="7" cy="8" r="3" stroke="currentColor" strokeWidth={2} />
    <path d="M2 20c0-2.8 2.2-5 5-5s5 2.2 5 5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    <circle cx="17" cy="8" r="3" stroke="currentColor" strokeWidth={2} />
    <path
      d="M12.5 15.2c.5-.1 1-.2 1.5-.2c2.8 0 5 2.2 5 5"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    />
  </svg>
);

export const ChevronRightIcon = ({ className }: { className?: string }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    className={className}>
    <path
      d="M9 6L15 12L9 18"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
