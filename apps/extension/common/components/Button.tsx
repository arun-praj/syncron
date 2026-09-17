import type { ButtonHTMLAttributes, ReactNode } from "react"

type ButtonVariant = "primary" | "secondary"

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  icon?: ReactNode
  children: ReactNode
}

export function Button({
  variant = "primary",
  icon,
  children,
  className = "",
  ...props
}: ButtonProps) {
  if (variant === "secondary") {
    return (
      <button
        className={`flex w-full items-center justify-center gap-2 rounded-input border border-border-input bg-white px-3.5 py-[9px] text-btn font-medium text-ink-primary transition-colors hover:border-border-input-hover hover:bg-neutral-50 ${className}`}
        {...props}>
        {icon}
        {children}
      </button>
    )
  }

  return (
    <button
      className={`w-full rounded-btn bg-gradient-to-b from-brand-top to-brand-bottom px-3.5 py-2.5 text-btn font-semibold text-white shadow-btn-primary transition-shadow hover:shadow-btn-primary-hover ${className}`}
      style={{ textShadow: "0 1px 2px rgba(0,0,0,.2)" }}
      {...props}>
      {children}
    </button>
  )
}
