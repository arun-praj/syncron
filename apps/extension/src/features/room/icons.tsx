// Room-screen icons, ported attribute-for-attribute from
// design/room-standalone.html's inline SVGs — width/height are literal
// HTML attributes (as in that file), not CSS classes, since these icons
// are reused at several different fixed sizes across the screen.
interface SizedIconProps {
  width?: number;
  height?: number;
  color?: string;
}

export function ClipboardIcon({ width = 15, height = 15, color = "currentColor" }: SizedIconProps) {
  return (
    <svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <rect x="8" y="2" width="8" height="4" rx="1" stroke={color} strokeWidth={2} />
      <path
        d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"
        stroke={color}
        strokeWidth={2}
      />
    </svg>
  );
}

export function LeaveIcon() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none">
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

export function SettingsIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7z"
        stroke="currentColor"
        strokeWidth={1.8}
      />
      <path
        d="M19.4 15a1.7 1.7 0 00.34 1.88l.06.06-1.7 1.7-.06-.06a1.7 1.7 0 00-1.88-.34 1.7 1.7 0 00-1.03 1.56V20h-2.4v-.2a1.7 1.7 0 00-1.03-1.56 1.7 1.7 0 00-1.88.34l-.06.06-1.7-1.7.06-.06A1.7 1.7 0 008.46 15a1.7 1.7 0 00-1.56-1.03H6v-2.4h.9A1.7 1.7 0 008.46 10a1.7 1.7 0 00-.34-1.88l-.06-.06 1.7-1.7.06.06a1.7 1.7 0 001.88.34A1.7 1.7 0 0012.73 5.2V5h2.4v.2a1.7 1.7 0 001.03 1.56 1.7 1.7 0 001.88-.34l.06-.06 1.7 1.7-.06.06A1.7 1.7 0 0019.4 10a1.7 1.7 0 001.56 1.03h.2v2.4h-.2A1.7 1.7 0 0019.4 15z"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Mic/camera glyphs are always 11x11 in the design regardless of where
// they're used (self-controls, compact member strip, member grid) — only
// the color varies, exactly mirroring the design's MIC_ICON_OFF/ON etc.
// helpers, which take a color argument but never a size one.
export function MicMiniIcon({ color = "currentColor" }: { color?: string }) {
  return (
    <svg width={11} height={11} viewBox="0 0 24 24" fill="none">
      <rect x="9" y="3" width="6" height="11" rx="3" stroke={color} strokeWidth={1.8} />
      <path d="M5 11a7 7 0 0014 0" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <path d="M12 18v3.5" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </svg>
  );
}

export function MicOffMiniIcon({ color = "currentColor" }: { color?: string }) {
  return (
    <svg width={11} height={11} viewBox="0 0 24 24" fill="none">
      <path d="M15 9.4V5a3 3 0 00-5.7-1.3" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <path d="M9 9v1a3 3 0 004.6 2.5" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <path d="M5 10a7 7 0 0010.5 6.1" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <path d="M19 10a6.9 6.9 0 01-.3 2" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <path d="M12 17v3.5" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <path d="M3 3L21 21" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </svg>
  );
}

export function CameraMiniIcon({ color = "currentColor" }: { color?: string }) {
  return (
    <svg width={11} height={11} viewBox="0 0 24 24" fill="none">
      <path d="M16 8l4-2v12l-4-2" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <rect x="3" y="6" width="13" height="12" rx="2" stroke={color} strokeWidth={1.8} />
    </svg>
  );
}

export function CameraOffMiniIcon({ color = "currentColor" }: { color?: string }) {
  return (
    <svg width={11} height={11} viewBox="0 0 24 24" fill="none">
      <path d="M16 8l4-2v12l-4-2" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <rect x="3" y="6" width="13" height="12" rx="2" stroke={color} strokeWidth={1.8} />
      <path d="M3 3L21 21" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </svg>
  );
}

export function SmileIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth={1.8} />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
      <circle cx="9" cy="9.5" r="1" fill="currentColor" />
      <circle cx="15" cy="9.5" r="1" fill="currentColor" />
    </svg>
  );
}

export function SendIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <path d="M22 2L11 13" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M22 2L15 22L11 13L2 9L22 2Z"
        stroke="#fff"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
