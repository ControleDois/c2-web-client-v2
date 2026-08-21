import type { InputHTMLAttributes, ReactNode } from 'react'

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  icon: ReactNode
  action?: ReactNode
  trailing?: ReactNode
}

export function TextField({ label, icon, action, trailing, ...inputProps }: TextFieldProps) {
  return (
    <label className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold text-[var(--ink-soft)]">{label}</span>
        {action}
      </div>
      <div className="flex items-center gap-2 rounded-xl bg-[var(--page)] px-3.5 py-2.5 ring-1 ring-transparent transition focus-within:ring-[var(--blue-300)]">
        <span className="h-4 w-4 flex-none text-[var(--muted)]">{icon}</span>
        <input
          {...inputProps}
          className="min-w-0 w-full bg-[var(--page)] text-[14px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none"
        />
        {trailing}
      </div>
    </label>
  )
}
