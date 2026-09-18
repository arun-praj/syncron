// Small stroke icons specific to the room screen's visual language
// (distinct paths/sizing from components/icons.tsx's set).
interface IconProps {
  className?: string;
}

export function ClipboardIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="8" y="2" width="8" height="4" rx="1" stroke="currentColor" strokeWidth={2} />
      <path
        d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"
        stroke="currentColor"
        strokeWidth={2}
      />
    </svg>
  );
}

export function LeaveIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 17l5-5-5-5"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M21 12H9" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MicMiniIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth={1.8} />
      <path d="M5 11a7 7 0 0014 0" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
      <path d="M12 18v3.5" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
    </svg>
  );
}

export function MicOffMiniIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M15 9.4V5a3 3 0 00-5.7-1.3" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
      <path d="M9 9v1a3 3 0 004.6 2.5" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
      <path d="M5 10a7 7 0 0010.5 6.1" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
      <path d="M19 10a6.9 6.9 0 01-.3 2" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
      <path d="M12 17v3.5" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
      <path d="M3 3L21 21" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
    </svg>
  );
}

export function CameraMiniIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M16 8l4-2v12l-4-2" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" />
      <rect x="3" y="6" width="13" height="12" rx="2" stroke="currentColor" strokeWidth={1.8} />
    </svg>
  );
}

export function CameraOffMiniIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M16 8l4-2v12l-4-2" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" />
      <rect x="3" y="6" width="13" height="12" rx="2" stroke="currentColor" strokeWidth={1.8} />
      <path d="M3 3L21 21" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
    </svg>
  );
}

export function SmileIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth={1.8} />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
      <circle cx="9" cy="9.5" r="1" fill="currentColor" />
      <circle cx="15" cy="9.5" r="1" fill="currentColor" />
    </svg>
  );
}

export function SendIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M22 2L11 13" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M22 2L15 22L11 13L2 9L22 2Z"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
