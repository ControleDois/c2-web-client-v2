import { useEffect, useMemo, useState } from 'react'
import { fetchTowingSales, fetchTowingDriverQueue, type TowingSaleRecord } from '../lib/towingSale'
import {
  buildTowingDashboard,
  getSaleValue,
  SALE_STATUS_LABELS,
  type StatusBreakdownItem,
} from '../lib/towingDashboard'
import { formatCurrency, formatPercent, formatDate } from '../lib/format'
import { BarChart } from '../components/charts/BarChart'
import { ApiError } from '../lib/api'
import { getCached, setCached } from '../lib/cache'
import {
  TruckIcon,
  CoinIcon,
  ClockIcon,
  AlertTriangleIcon,
  TrendUpIcon,
  RouteIcon,
  UserIcon,
} from '../components/icons'
import { getPersonName, type AuthCompany, type AuthSession } from '../lib/auth'

interface DashboardPageProps {
  session: AuthSession
  company: AuthCompany
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

function saleStatusTone(status: number): string {
  switch (status) {
    case 3:
      return 'bg-[var(--green-100)] text-[var(--green-600)]'
    case 2:
      return 'bg-[var(--amber-100)] text-[var(--amber-500)]'
    case 4:
      return 'bg-[var(--red-100)] text-[var(--red-500)]'
    case 5:
      return 'bg-[var(--blue-100)] text-[var(--blue-700)]'
    default:
      return 'bg-[var(--page)] text-[var(--ink-soft)]'
  }
}

function vehicleLabel(sale: TowingSaleRecord): string {
  const parts = [sale.vehicle?.brand, sale.vehicle?.model].filter(Boolean)
  return parts.length ? parts.join(' ') : '—'
}

function StatusBarList({ items }: { items: StatusBreakdownItem[] }) {
  const max = Math.max(...items.map((item) => item.total), 1)

  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <div key={item.status} className="flex items-center gap-3">
          <span className="w-[150px] flex-none truncate text-[12.5px] text-[var(--ink-soft)]">{item.label}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--page)]">
            <div
              className="h-full rounded-full bg-[var(--blue-500)]"
              style={{ width: `${(item.total / max) * 100}%` }}
            />
          </div>
          <span className="w-6 flex-none text-right text-[12.5px] font-bold text-[var(--ink)]">{item.total}</span>
        </div>
      ))}
    </div>
  )
}

export function DashboardPage({ session, company }: DashboardPageProps) {
  const [period, setPeriod] = useState<PeriodKey>('all')
  const [sales, setSales] = useState<TowingSaleRecord[]>([])
  const [queue, setQueue] = useState<TowingSaleRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const { start, end } = getPeriodRange(period)
    const cacheKey = `dashboard:${company.id}:${period}`
    const cached = getCached<{ sales: TowingSaleRecord[]; queue: TowingSaleRecord[] }>(cacheKey)

    if (cached) {
      setSales(cached.sales)
      setQueue(cached.queue)
      setLoading(false)
    } else {
      setLoading(true)
    }
    setError(null)

    Promise.all([
      fetchTowingSales(session.token.token, company.id, { dateStart: start, dateEnd: end }),
      fetchTowingDriverQueue(session.token.token, company.id),
    ])
      .then(([salesRes, queueRes]) => {
        if (cancelled) return
        const nextSales = salesRes.data || []
        const nextQueue = queueRes.data || []
        setSales(nextSales)
        setQueue(nextQueue)
        setCached(cacheKey, { sales: nextSales, queue: nextQueue })
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
  }, [period, company.id, session.token.token])

  const summary = useMemo(() => buildTowingDashboard(sales, queue), [sales, queue])

  const kpis = [
    {
      label: 'Faturamento no período',
      value: formatCurrency(summary.totalRevenue),
      icon: CoinIcon,
      tone: 'blue' as const,
    },
    {
      label: 'Guinchos no período',
      value: String(summary.totalSales),
      sub: `${summary.signedSales} assinados`,
      icon: TruckIcon,
      tone: 'blue' as const,
    },
    {
      label: 'Ticket médio',
      value: formatCurrency(summary.averageTicket),
      icon: TrendUpIcon,
      tone: 'green' as const,
    },
    {
      label: 'Taxa de conversão',
      value: formatPercent(summary.conversionRate),
      sub: 'assinados / total',
      icon: TrendUpIcon,
      tone: 'green' as const,
    },
    {
      label: 'Na fila operacional',
      value: String(summary.activeQueue),
      sub: `${summary.waitingPickup} aguardando · ${summary.inTransit} a caminho`,
      icon: ClockIcon,
      tone: 'neutral' as const,
    },
    {
      label: 'Retiradas não efetuadas',
      value: String(summary.failedPickup),
      sub: summary.canceledSales ? `${summary.canceledSales} cancelados no período` : 'nenhum cancelamento',
      icon: AlertTriangleIcon,
      tone: summary.failedPickup > 0 ? ('red' as const) : ('neutral' as const),
    },
  ]

  const toneClasses: Record<string, string> = {
    blue: 'bg-[var(--blue-100)] text-[var(--blue-700)]',
    green: 'bg-[var(--green-100)] text-[var(--green-600)]',
    red: 'bg-[var(--red-100)] text-[var(--red-500)]',
    neutral: 'bg-[var(--page)] text-[var(--ink-soft)]',
  }

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">
            Dashboard · Guincho / Cegonha
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
            {kpis.map((kpi) => (
              <div key={kpi.label} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <span
                  className={`mb-2.5 flex h-8 w-8 items-center justify-center rounded-lg ${toneClasses[kpi.tone]}`}
                >
                  <kpi.icon className="h-4 w-4" />
                </span>
                <p className="text-[11px] font-semibold text-[var(--muted)]">{kpi.label}</p>
                <p className="mt-1 text-[19px] font-bold tracking-tight text-[var(--ink)]">{kpi.value}</p>
                {kpi.sub && <p className="mt-0.5 text-[11px] text-[var(--muted)]">{kpi.sub}</p>}
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <h2 className="text-[14px] font-bold text-[var(--ink)]">Fila operacional</h2>
              <p className="mt-0.5 mb-4 text-[12px] text-[var(--muted)]">
                Guinchos assinados, por etapa da coleta
              </p>
              <StatusBarList items={summary.collectionStatus} />
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <h2 className="text-[14px] font-bold text-[var(--ink)]">Status dos guinchos</h2>
              <p className="mt-0.5 mb-4 text-[12px] text-[var(--muted)]">Todo o período selecionado</p>
              <StatusBarList items={summary.salesStatus} />
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <h2 className="text-[14px] font-bold text-[var(--ink)]">Faturamento por dia</h2>
            <p className="mt-0.5 mb-4 text-[12px] text-[var(--muted)]">Soma do valor de transporte por dia</p>
            <BarChart
              data={summary.dailyRevenue.map((point) => ({ label: point.label, value: point.total }))}
              formatValue={formatCurrency}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <h2 className="text-[14px] font-bold text-[var(--ink)]">Top motoristas</h2>
              <p className="mt-0.5 mb-4 text-[12px] text-[var(--muted)]">Guinchos assinados no período</p>
              {summary.topDrivers.length === 0 ? (
                <p className="py-6 text-center text-[13px] text-[var(--muted)]">Nenhum motorista com guinchos ainda.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {summary.topDrivers.map((driver, index) => (
                    <div key={driver.id} className="flex items-center gap-3">
                      <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[var(--blue-100)] text-[11px] font-bold text-[var(--blue-700)]">
                        {index + 1}
                      </span>
                      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-[var(--page)] text-[var(--ink-soft)]">
                        <UserIcon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold text-[var(--ink)]">
                          {driver.name}
                        </span>
                        <span className="block text-[11px] text-[var(--muted)]">
                          {driver.delivered} entregues · {driver.inProgress} em andamento
                        </span>
                      </span>
                      <span className="flex-none text-[13px] font-bold text-[var(--ink)]">{driver.total}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <h2 className="text-[14px] font-bold text-[var(--ink)]">Maiores fretes</h2>
              <p className="mt-0.5 mb-4 text-[12px] text-[var(--muted)]">Guinchos de maior valor no período</p>
              {summary.routeHighlights.length === 0 ? (
                <p className="py-6 text-center text-[13px] text-[var(--muted)]">Nenhum guincho no período.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {summary.routeHighlights.map((sale) => (
                    <div key={sale.id} className="flex items-center gap-3">
                      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-[var(--page)] text-[var(--ink-soft)]">
                        <RouteIcon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold text-[var(--ink)]">
                          {sale.people?.name ?? 'Cliente não informado'}
                        </span>
                        <span className="block truncate text-[11px] text-[var(--muted)]">
                          {sale.origin_city && sale.destination_city
                            ? `${sale.origin_city} → ${sale.destination_city}`
                            : vehicleLabel(sale)}
                        </span>
                      </span>
                      <span className="flex-none text-[13px] font-bold text-[var(--ink)]">
                        {formatCurrency(getSaleValue(sale))}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <h2 className="text-[14px] font-bold text-[var(--ink)]">Guinchos recentes</h2>
            <p className="mt-0.5 mb-4 text-[12px] text-[var(--muted)]">Os 8 lançamentos mais recentes</p>

            {summary.recentSales.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-[var(--muted)]">
                Nenhum guincho encontrado neste período.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-left text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                      <th className="pb-2.5">Código</th>
                      <th className="pb-2.5">Cliente</th>
                      <th className="pb-2.5">Veículo</th>
                      <th className="pb-2.5">Status</th>
                      <th className="pb-2.5">Data</th>
                      <th className="pb-2.5 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.recentSales.map((sale) => (
                      <tr key={sale.id} className="border-b border-[var(--border)] last:border-none">
                        <td className="py-2.5 font-mono text-[var(--ink-soft)]">#{sale.code}</td>
                        <td className="py-2.5 font-medium text-[var(--ink)]">{sale.people?.name ?? '—'}</td>
                        <td className="py-2.5 text-[var(--ink-soft)]">
                          {vehicleLabel(sale)}
                          {sale.vehicle?.license_plate ? ` · ${sale.vehicle.license_plate}` : ''}
                        </td>
                        <td className="py-2.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase ${saleStatusTone(Number(sale.status || 0))}`}
                          >
                            {SALE_STATUS_LABELS[Number(sale.status || 0)] ?? '—'}
                          </span>
                        </td>
                        <td className="py-2.5 text-[var(--ink-soft)]">{formatDate(sale.createdAt ?? sale.created_at)}</td>
                        <td className="py-2.5 text-right font-mono font-semibold text-[var(--ink)]">
                          {formatCurrency(getSaleValue(sale))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
