export function Divider({ label }: { label: string }) {
  return (
    <div className="my-4 flex items-center gap-2.5">
      <div className="h-px flex-1 bg-border" />
      <span className="whitespace-nowrap text-divider uppercase text-ink-placeholder">
        {label}
      </span>
      <div className="h-px flex-1 bg-border" />
    </div>
  )
}
