import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react"

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  trailing?: ReactNode
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, trailing, error, id, className = "", ...props },
  ref
) {
  return (
    <div className="flex flex-col gap-[5px]">
      {label && (
        <label htmlFor={id} className="text-label font-medium text-ink-label">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          id={id}
          ref={ref}
          className={`w-full rounded-input border bg-white px-3 py-[9px] text-input text-ink-primary outline-none transition-colors placeholder:text-ink-placeholder focus:border-ink-primary focus:shadow-focus ${
            trailing ? "pr-10" : ""
          } ${error ? "border-red-400" : "border-border-input"} ${className}`}
          {...props}
        />
        {trailing && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">{trailing}</div>
        )}
      </div>
      {error && <span className="text-[11px] text-red-500">{error}</span>}
    </div>
  )
})
