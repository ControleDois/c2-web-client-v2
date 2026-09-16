import { useEffect, useMemo, useState } from 'react'
import { fetchSales, type SaleRecord } from '../lib/sales'
import { fetchBillsSummary, type BillsSummary } from '../lib/bills'
import { formatCurrency } from '../lib/format'
import { BarChart } from '../components/charts/BarChart'
import { ApiError } from '../lib/api'
import { getCached, setCached } from '../lib/cache'
import { CoinIcon, WalletIcon, AlertTriangleIcon, UserIcon, TrendUpIcon, WhatsappIcon } from '../components/icons'
import { getPersonName, type AuthCompany, type AuthSession } from '../lib/auth'
import { SUPPORT_PHONE_DISPLAY, SUPPORT_WHATSAPP_URL } from '../lib/support'
import type { SalesStatusFilter } from '../lib/loanModalities'

interface LoanDashboardPageProps {
  session: AuthSession
  company: AuthCompany
  onNavigateToSales?: (filter: SalesStatusFilter) => void
}

type PeriodKey = 'all' | 'today' | '7d' | 'month'

const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: 'all', label: 'Tudo' },
  { key: 'today', label: 'Hoje' },
  { key: '7d', label: '7 dias' },
  { key: 'month', label: 'Este mês' },
]

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function getPeriodRange(key: PeriodKey): { start?: string; end?: string } {
  const now = new Date()

  if (key === 'today') {
    const today = toISODate(now)
    return { start: today, end: today }
  }
  if (key === '7d') {
    const start = new Date(now)
    start.setDate(start.getDate() - 6)
    return { start: toISODate(start), end: toISODate(now) }
  }
  if (key === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return { start: toISODate(start), end: toISODate(end) }
  }
  return {}
}

function inRange(dateValue: string | undefined, start?: string, end?: string): boolean {
  if (!start && !end) return true
  if (!dateValue) return false
  const date = dateValue.slice(0, 10)
  if (start && date < start) return false
  if (end && date > end) return false
  return true
}

const EMPTY_SUMMARY: BillsSummary = {
  pending: { count: 0, total: 0 },
  paid: { count: 0, total: 0 },
  overdue: { count: 0, total: 0 },
  total: { count: 0, total: 0 },
}

export function LoanDashboardPage({ session, company, onNavigateToSales }: LoanDashboardPageProps) {
  const [period, setPeriod] = useState<PeriodKey>('all')
  const [sales, setSales] = useState<SaleRecord[]>([])
  const [billsSummary, setBillsSummary] = useState<BillsSummary>(EMPTY_SUMMARY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const cacheKey = `loan-dashboard:${company.id}`
    const cached = getCached<{ sales: SaleRecord[]; billsSummary: BillsSummary }>(cacheKey)

    if (cached) {
      setSales(cached.sales)
      setBillsSummary(cached.billsSummary)
      setLoading(false)
    } else {
      setLoading(true)
    }
    setError(null)

    Promise.all([
      fetchSales(session.token.token, company.id, { limit: 5000 }),
      fetchBillsSummary(session.token.token, company.id, { role: 1 }),
    ])
      .then(([salesRes, summaryRes]) => {
        if (cancelled) return
        const nextSales = salesRes.data || []
        setSales(nextSales)
        setBillsSummary(summaryRes)
        setCached(cacheKey, { sales: nextSales, billsSummary: summaryRes })
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof ApiError ? err.message : 'Não foi possível carregar o dashboard.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [company.id, session.token.token])

  const { start, end } = getPeriodRange(period)

  const periodSales = useMemo(
    () => sales.filter((sale) => inRange(sale.date_sale ?? sale.created_at, start, end)),
    [sales, start, end]
  )

  const totalLent = useMemo(
    () => periodSales.reduce((sum, sale) => sum + Number(sale.amount || 0), 0),
    [periodSales]
  )
  const totalWithInterest = useMemo(
    () => periodSales.reduce((sum, sale) => sum + Number(sale.net_total || 0), 0),
    [periodSales]
  )
  const averageTicket = periodSales.length > 0 ? totalLent / periodSales.length : 0
  const activeCustomers = useMemo(
    () => new Set(periodSales.map((sale) => sale.people?.id).filter(Boolean)).size,
    [periodSales]
  )

  const dailyLent = useMemo(() => {
    const byDay = new Map<string, number>()
    for (const sale of periodSales) {
      const date = sale.date_sale ?? sale.created_at
      if (!date) continue
      const day = date.slice(0, 10)
      byDay.set(day, (byDay.get(day) || 0) + Number(sale.amount || 0))
    }
    return Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)
      .map(([day, total]) => ({ label: day.slice(5).split('-').reverse().join('/'), value: total }))
  }, [periodSales])

  const recentSales = useMemo(
    () =>
      [...periodSales]
        .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
        .slice(0, 8),
    [periodSales]
  )

  const kpis = [
    {
      label: 'Total Emprestado',
      value: formatCurrency(totalLent),
      sub: `${periodSales.length} venda${periodSales.length === 1 ? '' : 's'} no período`,
      icon: CoinIcon,
      tone: 'blue' as const,
      filter: 'all' as SalesStatusFilter,
    },
    {
      label: 'A Receber (em aberto)',
      value: formatCurrency(billsSummary.pending.total),
      sub: `${billsSummary.pending.count} parcela${billsSummary.pending.count === 1 ? '' : 's'}`,
      icon: TrendUpIcon,
      tone: 'blue' as const,
      filter: 'aberto' as SalesStatusFilter,
    },
    {
      label: 'Em Atraso',
      value: formatCurrency(billsSummary.overdue.total),
      sub: `${billsSummary.overdue.count} parcela${billsSummary.overdue.count === 1 ? '' : 's'}`,
      icon: AlertTriangleIcon,
      tone: 'red' as const,
      filter: 'atrasado' as SalesStatusFilter,
    },
    {
      label: 'Recebido',
      value: formatCurrency(billsSummary.paid.total),
      sub: `${billsSummary.paid.count} parcela${billsSummary.paid.count === 1 ? '' : 's'}`,
      icon: WalletIcon,
      tone: 'green' as const,
    },
    {
      label: 'Ticket médio',
      value: formatCurrency(averageTicket),
      icon: TrendUpIcon,
      tone: 'neutral' as const,
    },
    {
      label: 'Clientes ativos',
      value: String(activeCustomers),
      sub: 'no período',
      icon: UserIcon,
      tone: 'neutral' as const,
    },
  ]

  const toneClasses: Record<string, string> = {
    blue: 'bg-[var(--blue-100)] text-[var(--blue-700)]',
    green: 'bg-[var(--green-100)] text-[var(--green-600)]',
    red: 'bg-[var(--red-100)] text-[var(--red-500)]',
    neutral: 'bg-[var(--page)] text-[var(--ink-soft)]',
  }

  return (
    <div
      className="flex flex-col gap-6 p-4 pb-6 sm:p-6 lg:p-8"
      style={{ paddingBottom: 'max(1.5rem, calc(env(safe-area-inset-bottom) + 4.5rem))' }}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">
            Dashboard · Juros / Empréstimos
          </p>
          <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">
            Olá, {getPersonName(session.user)}
          </h1>
        </div>

        <div className="flex gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1">
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setPeriod(option.key)}
              className={`rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition ${
                period === option.key
                  ? 'bg-[var(--blue-500)] text-white'
                  : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-2xl bg-[var(--red-100)] p-4 text-[13.5px] font-medium text-[var(--red-500)]">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-[104px] animate-pulse rounded-2xl bg-[var(--surface)]" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
            {kpis.map((kpi) => {
              const clickable = Boolean(kpi.filter && onNavigateToSales)
              const Wrapper = clickable ? 'button' : 'div'
              return (
                <Wrapper
                  key={kpi.label}
                  type={clickable ? 'button' : undefined}
                  onClick={clickable ? () => onNavigateToSales?.(kpi.filter!) : undefined}
                  className={`rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-left transition ${
                    clickable ? 'cursor-pointer hover:border-[var(--blue-300)] hover:shadow-[var(--card-shadow)]' : ''
                  }`}
                >
                  <span
                    className={`mb-2.5 flex h-8 w-8 items-center justify-center rounded-lg ${toneClasses[kpi.tone]}`}
                  >
                    <kpi.icon className="h-4 w-4" />
                  </span>
                  <p className="text-[11px] font-semibold text-[var(--muted)]">{kpi.label}</p>
                  <p className="mt-1 text-[19px] font-bold tracking-tight text-[var(--ink)]">{kpi.value}</p>
                  {kpi.sub && <p className="mt-0.5 text-[11px] text-[var(--muted)]">{kpi.sub}</p>}
                </Wrapper>
              )
            })}
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <h2 className="text-[14px] font-bold text-[var(--ink)]">Total com juros no período</h2>
            <p className="mt-0.5 text-[12px] text-[var(--muted)]">
              Soma do montante total (capital + juros) das vendas do período selecionado
            </p>
            <p className="mt-3 text-[26px] font-bold tracking-tight text-[var(--green-600)]">
              {formatCurrency(totalWithInterest)}
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <h2 className="text-[14px] font-bold text-[var(--ink)]">Emprestado por dia</h2>
            <p className="mt-0.5 mb-4 text-[12px] text-[var(--muted)]">Soma do valor principal por dia da venda</p>
            <BarChart data={dailyLent} formatValue={formatCurrency} />
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <h2 className="text-[14px] font-bold text-[var(--ink)]">Vendas recentes</h2>
            <p className="mt-0.5 mb-4 text-[12px] text-[var(--muted)]">As 8 vendas mais recentes no período</p>

            {recentSales.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-[var(--muted)]">
                Nenhuma venda encontrada neste período.
              </p>
            ) : (
              <>
                <div className="flex flex-col gap-2.5 sm:hidden">
                  {recentSales.map((sale) => (
                    <div key={sale.id} className="rounded-xl border border-[var(--border)] p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 truncate text-[13px] font-bold text-[var(--ink)]">
                          #{sale.internal_code ?? sale.code} · {sale.people?.name ?? '—'}
                        </p>
                        <span className="flex-none font-mono text-[12px] font-semibold text-[var(--green-600)]">
                          {formatCurrency(Number(sale.net_total || 0))}
                        </span>
                      </div>
                      <p className="mt-1 text-[12px] text-[var(--ink-soft)]">
                        Principal {formatCurrency(Number(sale.amount || 0))} · {sale.payment_terms ?? 0}x
                      </p>
                    </div>
                  ))}
                </div>

                <div className="hidden overflow-x-auto sm:block">
                  <table className="w-full border-collapse text-[13px]">
                    <thead>
                      <tr className="border-b border-[var(--border)] text-left text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                        <th className="pb-2.5">Código</th>
                        <th className="pb-2.5">Cliente</th>
                        <th className="pb-2.5 text-right">Principal</th>
                        <th className="pb-2.5 text-center">Parcelas</th>
                        <th className="pb-2.5 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentSales.map((sale) => (
                        <tr key={sale.id} className="border-b border-[var(--border)] last:border-none">
                          <td className="py-2.5 font-mono text-[var(--ink-soft)]">#{sale.internal_code ?? sale.code}</td>
                          <td className="py-2.5 font-medium text-[var(--ink)]">{sale.people?.name ?? '—'}</td>
                          <td className="py-2.5 text-right text-[var(--ink-soft)]">
                            {formatCurrency(Number(sale.amount || 0))}
                          </td>
                          <td className="py-2.5 text-center text-[var(--ink-soft)]">{sale.payment_terms ?? 0}x</td>
                          <td className="py-2.5 text-right font-mono font-semibold text-[var(--green-600)]">
                            {formatCurrency(Number(sale.net_total || 0))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="flex items-center gap-3.5">
              <span className="flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-[#e8faf0] text-[#1da851]">
                <WhatsappIcon className="h-5.5 w-5.5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[12px] text-[var(--muted)]">Precisa de ajuda?</p>
                <p className="truncate text-[15.5px] font-bold text-[var(--ink)]">{SUPPORT_PHONE_DISPLAY}</p>
              </div>
            </div>
            <a
              href={SUPPORT_WHATSAPP_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-4 flex w-full items-center justify-center rounded-xl bg-[var(--blue-500)] py-3 text-[13.5px] font-bold text-white transition hover:bg-[var(--blue-700)] sm:w-auto sm:px-6"
            >
              Entrar em contato
            </a>
          </div>
        </>
      )}
    </div>
  )
}
