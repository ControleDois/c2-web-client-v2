import { useEffect, useState } from 'react'
import { fetchBillsSummary, type BillsSummary } from '../lib/bills'
import { formatCurrency } from '../lib/format'
import type { AuthSession, AuthCompany } from '../lib/auth'

export type BillsSummaryFilter = 'overdue' | 'pending' | 'paid' | 'total'

interface BillsSummaryCardsProps {
  session: AuthSession
  company: AuthCompany
  role: 0 | 1
  search?: string
  dateStart?: string
  dateEnd?: string
  peopleId?: string
  categoryId?: string
  bankAccountId?: string
  formPaymentType?: number
  activeFilter: BillsSummaryFilter | null
  onFilterChange: (filter: BillsSummaryFilter | null) => void
  refreshKey?: number
}

export function BillsSummaryCards({
  session,
  company,
  role,
  search,
  dateStart,
  dateEnd,
  peopleId,
  categoryId,
  bankAccountId,
  formPaymentType,
  activeFilter,
  onFilterChange,
  refreshKey,
}: BillsSummaryCardsProps) {
  const [summary, setSummary] = useState<BillsSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchBillsSummary(session.token.token, company.id, {
      role,
      search,
      dateStart,
      dateEnd,
      peopleId,
      categoryId,
      bankAccountId,
      formPaymentType,
    })
      .then((res) => {
        if (!cancelled) setSummary(res)
      })
      .catch(() => {
        if (!cancelled) setSummary(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [session.token.token, company.id, role, search, dateStart, dateEnd, peopleId, categoryId, bankAccountId, formPaymentType, refreshKey])

  const cards: { key: BillsSummaryFilter; label: string; count: number; total: number; barVar: string; textVar: string }[] = [
    { key: 'overdue', label: 'Em atraso', count: summary?.overdue.count ?? 0, total: summary?.overdue.total ?? 0, barVar: '--red-500', textVar: '--red-500' },
    {
      key: 'pending',
      label: role === 1 ? 'A receber' : 'A pagar',
      count: summary?.pending.count ?? 0,
      total: summary?.pending.total ?? 0,
      barVar: '--blue-500',
      textVar: '--blue-700',
    },
    {
      key: 'paid',
      label: role === 1 ? 'Recebido' : 'Pago',
      count: summary?.paid.count ?? 0,
      total: summary?.paid.total ?? 0,
      barVar: '--green-600',
      textVar: '--green-600',
    },
    { key: 'total', label: 'Total', count: summary?.total.count ?? 0, total: summary?.total.total ?? 0, barVar: '--ink', textVar: '--ink' },
  ]

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--card-shadow)]">
      <div className="grid grid-cols-2 divide-y divide-[var(--border)] sm:grid-cols-4 sm:divide-x sm:divide-y-0">
        {cards.map((card) => {
          const isActive = activeFilter === card.key
          const dimmed = activeFilter !== null && !isActive
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => onFilterChange(isActive ? null : card.key)}
              className={`relative py-5 text-center transition-all duration-300 hover:bg-[var(--page)] ${
                dimmed ? 'opacity-40' : ''
              }`}
            >
              <span
                className="absolute left-0 right-0 top-0 transition-all duration-300"
                style={{ height: isActive ? 6 : 0, backgroundColor: `var(${card.barVar})` }}
              />
              <dt className="text-[12px] font-semibold text-[var(--muted)]">
                {card.label} ({loading ? '…' : card.count})
              </dt>
              <dd className="mt-1 text-[17px] font-bold tracking-tight" style={{ color: `var(${card.textVar})` }}>
                {loading ? '—' : formatCurrency(card.total)}
              </dd>
            </button>
          )
        })}
      </div>
    </div>
  )
}
