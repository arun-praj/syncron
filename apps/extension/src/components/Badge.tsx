export type SyncStatus = "synced" | "syncing" | "out-of-sync";

const statusStyles: Record<SyncStatus, string> = {
  synced: "bg-green-50 text-green-700",
  syncing: "bg-amber-50 text-amber-700",
  "out-of-sync": "bg-red-50 text-red-700",
};

const statusDot: Record<SyncStatus, string> = {
  synced: "bg-green-500",
  syncing: "animate-[sync-pulse_1.5s_cubic-bezier(.4,0,.6,1)_infinite] bg-amber-500",
  "out-of-sync": "bg-red-500",
};

const statusLabel: Record<SyncStatus, string> = {
  synced: "Synced",
  syncing: "Syncing…",
  "out-of-sync": "Out of sync",
};

export function Badge({ status }: { status: SyncStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${statusStyles[status]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${statusDot[status]}`} />
      {statusLabel[status]}
    </span>
  );
}
