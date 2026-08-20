import type { SelectHTMLAttributes, ReactNode } from 'react'
import { ChevronDownIcon } from '../icons'

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  children: ReactNode
}

export function SelectField({ label, children, ...props }: SelectFieldProps) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12px] font-semibold text-[var(--ink-soft)]">{label}</span>
      <div className="relative flex items-center rounded-xl bg-[var(--page)] px-3.5 py-2.5 ring-1 ring-transparent transition focus-within:ring-[var(--blue-300)]">
        <select
          {...props}
          className="w-full appearance-none bg-transparent text-[14px] text-[var(--ink)] focus:outline-none"
        >
          {children}
        </select>
        <ChevronDownIcon className="pointer-events-none h-3.5 w-3.5 flex-none text-[var(--muted)]" />
      </div>
    </label>
  )
}
