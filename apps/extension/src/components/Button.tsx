import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  icon?: ReactNode;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  icon,
  children,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  if (variant === "secondary") {
    return (
      <button
        disabled={disabled}
        className={`flex w-full items-center justify-center gap-2 rounded-input border border-border-input bg-white px-3.5 py-[9px] text-btn font-medium text-ink-primary transition-[background-color,border-color,box-shadow,transform] duration-200 ease-standard hover:border-border-input-hover hover:bg-neutral-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border-input disabled:hover:bg-white disabled:active:scale-100 ${className}`}
        {...props}>
        {icon}
        {children}
      </button>
    );
  }

  return (
    <button
      disabled={disabled}
      className={`flex w-full items-center justify-center gap-2 rounded-btn bg-gradient-to-b from-brand-top to-brand-bottom px-3.5 py-2.5 text-btn font-semibold text-white shadow-btn-primary transition-[box-shadow,transform] duration-200 ease-standard hover:shadow-btn-primary-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-btn-primary disabled:active:scale-100 ${className}`}
      style={{ textShadow: "0 1px 2px rgba(0,0,0,.2)" }}
      {...props}>
      {icon}
      {children}
    </button>
  );
}
