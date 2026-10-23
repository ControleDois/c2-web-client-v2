import { useEffect, useState } from 'react'
import { fetchLicenseSummary, type LicenseSummary, type LicenseSummaryFilter } from '../lib/licenses'
import { formatCurrency } from '../lib/format'
import type { AuthSession } from '../lib/auth'

interface LicensesSummaryCardsProps {
  session: AuthSession
  search?: string
  representative?: string | null
  activeFilter: LicenseSummaryFilter | null
  onFilterChange: (filter: LicenseSummaryFilter | null) => void
  refreshKey?: number
}

const CARDS: { key: LicenseSummaryFilter; label: string; barVar: string; textVar: string }[] = [
  { key: 'overdue', label: 'Vencidas', barVar: '--red-500', textVar: '--red-500' },
  { key: 'expiring', label: 'A vencer (30 dias)', barVar: '--amber-500', textVar: '--amber-500' },
  { key: 'billed', label: 'Cobranças geradas', barVar: '--blue-500', textVar: '--blue-700' },
  { key: 'delphi', label: 'Chaves Delphi', barVar: '--green-600', textVar: '--green-600' },
  { key: 'all', label: 'Total', barVar: '--ink', textVar: '--ink' },
]

export function LicensesSummaryCards({ session, search, representative, activeFilter, onFilterChange, refreshKey }: LicensesSummaryCardsProps) {
  const [summary, setSummary] = useState<LicenseSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const timeout = setTimeout(() => {
      fetchLicenseSummary(session.token.token, search || undefined, representative)
        .then((res) => {
          if (!cancelled) setSummary(res)
        })
        .catch(() => {
          if (!cancelled) setSummary(null)
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 350)
    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [session.token.token, search, representative, refreshKey])

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--card-shadow)]">
      <div className="grid grid-cols-2 divide-y divide-[var(--border)] sm:grid-cols-5 sm:divide-x sm:divide-y-0">
        {CARDS.map((card) => {
          const isActive = activeFilter === card.key
          const dimmed = activeFilter !== null && !isActive
          const data = summary?.[card.key]
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => onFilterChange(isActive ? null : card.key)}
              className={`relative py-5 text-center transition-all duration-300 hover:bg-[var(--page)] ${dimmed ? 'opacity-40' : ''}`}
            >
              <span
                className="absolute left-0 right-0 top-0 transition-all duration-300"
                style={{ height: isActive ? 6 : 0, backgroundColor: `var(${card.barVar})` }}
              />
              <dt className="text-[12px] font-semibold text-[var(--muted)]">
                {card.label} ({loading ? '…' : (data?.count ?? 0)})
              </dt>
              <dd className="mt-1 text-[17px] font-bold tracking-tight" style={{ color: `var(${card.textVar})` }}>
                {loading ? '—' : formatCurrency(data?.total ?? 0)}
              </dd>
            </button>
          )
        })}
      </div>
    </div>
  )
}
