import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`w-full rounded-card border border-border bg-white p-5 shadow-card ${className}`}>
      {children}
    </div>
  );
}
