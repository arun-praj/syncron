import type { ButtonHTMLAttributes, ReactNode } from "react";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  active?: boolean;
  variant?: "default" | "danger";
}

export function IconButton({
  icon,
  active,
  variant = "default",
  className = "",
  ...props
}: IconButtonProps) {
  const base =
    "flex h-10 w-10 items-center justify-center rounded-full transition-[background-color,box-shadow,transform] duration-150 ease-standard active:scale-[0.96] disabled:active:scale-100";
  const styles =
    variant === "danger"
      ? "bg-red-500 text-white hover:bg-red-600"
      : active
        ? "bg-neutral-900 text-white hover:bg-neutral-800"
        : "bg-neutral-100 text-ink-primary hover:bg-neutral-200";

  return (
    <button className={`${base} ${styles} ${className}`} {...props}>
      {icon}
    </button>
  );
}
