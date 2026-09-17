export function Logo() {
  return (
    <div className="flex items-center gap-2">
      <svg width="22" height="22" viewBox="0 0 30 30" fill="none">
        <circle cx="12" cy="15" r="10" stroke="#18181b" strokeWidth="2" />
        <circle cx="19" cy="12" r="7" stroke="#18181b" strokeWidth="2" fill="#fff" />
        <path d="M17 10.5L21.5 12.5L17 14.5V10.5Z" fill="#18181b" />
      </svg>
      <span className="text-logo font-bold text-ink-primary">Syncron</span>
    </div>
  );
}
