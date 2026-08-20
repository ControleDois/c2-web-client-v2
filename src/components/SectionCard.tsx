import { useState, type ReactNode } from 'react'
import { ChevronDownIcon } from './icons'

interface SectionCardProps {
  title: string
  subtitle?: string
  defaultCollapsed?: boolean
  headerExtra?: ReactNode
  children: ReactNode
}

export function SectionCard({ title, subtitle, defaultCollapsed = false, headerExtra, children }: SectionCardProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setCollapsed((current) => !current)}
          className="flex flex-1 items-center gap-3 text-left"
        >
          <div>
            <h2 className="text-[14px] font-bold text-[var(--ink)]">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[12px] text-[var(--muted)]">{subtitle}</p>}
          </div>
        </button>
        <div className="flex flex-none items-center gap-2">
          {headerExtra}
          <button
            type="button"
            onClick={() => setCollapsed((current) => !current)}
            aria-label={collapsed ? 'Maximizar' : 'Minimizar'}
            title={collapsed ? 'Maximizar' : 'Minimizar'}
            className="flex h-7 w-7 flex-none items-center justify-center rounded-lg text-[var(--muted)] transition hover:bg-[var(--page)] hover:text-[var(--ink)]"
          >
            <ChevronDownIcon
              className={`h-3.5 w-3.5 transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`}
            />
          </button>
        </div>
      </div>
      {!collapsed && <div className="mt-4">{children}</div>}
    </div>
  )
}
