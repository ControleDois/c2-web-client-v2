import { useEffect, useMemo, useState } from 'react'
import {
  fetchSales,
  VEHICLE_RENTAL_STATUS_LABELS,
  VEHICLE_SALE_STATUS_LABELS,
  type SaleRecord,
} from '../lib/sales'
import { fetchOrderServices, type OrderServiceRecord } from '../lib/orderServices'
import { fetchVehicles } from '../lib/vehicles'
import { formatCurrency } from '../lib/format'
import { BarChart } from '../components/charts/BarChart'
import { ApiError } from '../lib/api'
import { getCached, setCached } from '../lib/cache'
import { CoinIcon, KeyIcon, TrendUpIcon, TruckIcon, WrenchIcon, ClockIcon } from '../components/icons'
import { getPersonName, type AuthCompany, type AuthSession } from '../lib/auth'

interface RentalDashboardPageProps {
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

function recordDate(sale: SaleRecord): string | undefined {
  return sale.created_at
}

function inRange(dateValue: string | undefined, start?: string, end?: string): boolean {
  if (!start && !end) return true
  if (!dateValue) return false
  const date = dateValue.slice(0, 10)
  if (start && date < start) return false
  if (end && date > end) return false
  return true
}

function StatusBarList({ items }: { items: { label: string; total: number }[] }) {
  const max = Math.max(...items.map((item) => item.total), 1)

  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-3">
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

export function RentalDashboardPage({ session, company }: RentalDashboardPageProps) {
  const [period, setPeriod] = useState<PeriodKey>('all')
  const [sales, setSales] = useState<SaleRecord[]>([])
  const [orderServices, setOrderServices] = useState<OrderServiceRecord[]>([])
  const [vehicleCount, setVehicleCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const cacheKey = `rental-dashboard:${company.id}`
    const cached = getCached<{ sales: SaleRecord[]; orderServices: OrderServiceRecord[]; vehicleCount: number }>(cacheKey)

    if (cached) {
      setSales(cached.sales)
      setOrderServices(cached.orderServices)
      setVehicleCount(cached.vehicleCount)
      setLoading(false)
    } else {
      setLoading(true)
    }
    setError(null)

    Promise.all([
      fetchSales(session.token.token, company.id, { limit: 500 }),
      fetchOrderServices(session.token.token, company.id, { limit: 500, dateStart: '1970-01-01', dateEnd: toISODate(new Date()) }),
      fetchVehicles(session.token.token, company.id, { limit: 1 }),
    ])
      .then(([salesRes, orderServicesRes, vehiclesRes]) => {
        if (cancelled) return
        const nextSales = (salesRes.data || []).filter((sale) => sale.vehicleRentalContract || sale.vehicleSaleContract)
        const nextOrderServices = orderServicesRes.data || []
        const nextVehicleCount = vehiclesRes.meta?.total ?? 0
        setSales(nextSales)
        setOrderServices(nextOrderServices)
        setVehicleCount(nextVehicleCount)
        setCached(cacheKey, { sales: nextSales, orderServices: nextOrderServices, vehicleCount: nextVehicleCount })
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
    () => sales.filter((sale) => inRange(recordDate(sale), start, end)),
    [sales, start, end]
  )

  const rentals = useMemo(() => periodSales.filter((sale) => sale.vehicleRentalContract), [periodSales])
  const vendas = useMemo(() => periodSales.filter((sale) => sale.vehicleSaleContract), [periodSales])
  const allRentals = useMemo(() => sales.filter((sale) => sale.vehicleRentalContract), [sales])

  const totalRevenue = useMemo(
    () => periodSales.reduce((sum, sale) => sum + Number(sale.net_total || 0), 0),
    [periodSales]
  )
  const averageTicket = periodSales.length > 0 ? totalRevenue / periodSales.length : 0
  const activeRentals = allRentals.filter((sale) => sale.vehicleRentalContract?.status === 1).length
  const openOrderServices = orderServices.filter((os) => os.status < 6)

  const rentalStatusBreakdown = useMemo(() => {
    const counts: Record<number, number> = {}
    for (const sale of rentals) {
      const status = sale.vehicleRentalContract?.status ?? 0
      counts[status] = (counts[status] || 0) + 1
    }
    return Object.entries(VEHICLE_RENTAL_STATUS_LABELS).map(([status, label]) => ({
      label,
      total: counts[Number(status)] || 0,
    }))
  }, [rentals])

  const saleStatusBreakdown = useMemo(() => {
    const counts: Record<number, number> = {}
    for (const sale of vendas) {
      const status = sale.vehicleSaleContract?.status ?? 0
      counts[status] = (counts[status] || 0) + 1
    }
    return Object.entries(VEHICLE_SALE_STATUS_LABELS).map(([status, label]) => ({
      label,
      total: counts[Number(status)] || 0,
    }))
  }, [vendas])

  const dailyRevenue = useMemo(() => {
    const byDay = new Map<string, number>()
    for (const sale of periodSales) {
      const date = recordDate(sale)
      if (!date) continue
      const day = date.slice(0, 10)
      byDay.set(day, (byDay.get(day) || 0) + Number(sale.net_total || 0))
    }
    return Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)
      .map(([day, total]) => ({ label: day.slice(5).split('-').reverse().join('/'), value: total }))
  }, [periodSales])

  const recentRecords = useMemo(
    () =>
      [...periodSales]
        .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
        .slice(0, 8),
    [periodSales]
  )

  const kpis = [
    {
      label: 'Faturamento no período',
      value: formatCurrency(totalRevenue),
      icon: CoinIcon,
      tone: 'blue' as const,
    },
    {
      label: 'Aluguéis no período',
      value: String(rentals.length),
      sub: `${activeRentals} ativos no total`,
      icon: KeyIcon,
      tone: 'blue' as const,
    },
    {
      label: 'Vendas no período',
      value: String(vendas.length),
      icon: TruckIcon,
      tone: 'green' as const,
    },
    {
      label: 'Ticket médio',
      value: formatCurrency(averageTicket),
      icon: TrendUpIcon,
      tone: 'green' as const,
    },
    {
      label: 'OS em aberto',
      value: String(openOrderServices.length),
      icon: WrenchIcon,
      tone: 'neutral' as const,
    },
    {
      label: 'Veículos cadastrados',
      value: String(vehicleCount),
      icon: ClockIcon,
      tone: 'neutral' as const,
    },
  ]

  const toneClasses: Record<string, string> = {
    blue: 'bg-[var(--blue-100)] text-[var(--blue-700)]',
    green: 'bg-[var(--green-100)] text-[var(--green-600)]',
    neutral: 'bg-[var(--page)] text-[var(--ink-soft)]',
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">
            Dashboard · Locação de Veículos
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
              <h2 className="text-[14px] font-bold text-[var(--ink)]">Status dos aluguéis</h2>
              <p className="mt-0.5 mb-4 text-[12px] text-[var(--muted)]">No período selecionado</p>
              <StatusBarList items={rentalStatusBreakdown} />
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <h2 className="text-[14px] font-bold text-[var(--ink)]">Status das vendas</h2>
              <p className="mt-0.5 mb-4 text-[12px] text-[var(--muted)]">No período selecionado</p>
              <StatusBarList items={saleStatusBreakdown} />
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <h2 className="text-[14px] font-bold text-[var(--ink)]">Faturamento por dia</h2>
            <p className="mt-0.5 mb-4 text-[12px] text-[var(--muted)]">Aluguéis e vendas somados por dia de cadastro</p>
            <BarChart data={dailyRevenue} formatValue={formatCurrency} />
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <h2 className="text-[14px] font-bold text-[var(--ink)]">Lançamentos recentes</h2>
            <p className="mt-0.5 mb-4 text-[12px] text-[var(--muted)]">Os 8 aluguéis e vendas mais recentes</p>

            {recentRecords.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-[var(--muted)]">
                Nenhum lançamento encontrado neste período.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-left text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                      <th className="pb-2.5">Código</th>
                      <th className="pb-2.5">Tipo</th>
                      <th className="pb-2.5">Cliente</th>
                      <th className="pb-2.5">Veículo</th>
                      <th className="pb-2.5">Status</th>
                      <th className="pb-2.5 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentRecords.map((sale) => {
                      const isRental = Boolean(sale.vehicleRentalContract)
                      const person = isRental ? sale.vehicleRentalContract?.renter : sale.vehicleSaleContract?.buyer
                      const status = isRental ? sale.vehicleRentalContract?.status : sale.vehicleSaleContract?.status
                      const statusLabel = isRental
                        ? VEHICLE_RENTAL_STATUS_LABELS[status ?? 0]
                        : VEHICLE_SALE_STATUS_LABELS[status ?? 0]
                      return (
                        <tr key={sale.id} className="border-b border-[var(--border)] last:border-none">
                          <td className="py-2.5 font-mono text-[var(--ink-soft)]">#{sale.internal_code ?? sale.code}</td>
                          <td className="py-2.5 text-[var(--ink-soft)]">{isRental ? 'Aluguel' : 'Venda'}</td>
                          <td className="py-2.5 font-medium text-[var(--ink)]">{person?.name ?? '—'}</td>
                          <td className="py-2.5 text-[var(--ink-soft)]">
                            {[sale.vehicle?.brand, sale.vehicle?.model].filter(Boolean).join(' ') || sale.vehicle?.license_plate || '—'}
                          </td>
                          <td className="py-2.5 text-[var(--ink-soft)]">{statusLabel ?? '—'}</td>
                          <td className="py-2.5 text-right font-mono font-semibold text-[var(--ink)]">
                            {formatCurrency(Number(sale.net_total || 0))}
                          </td>
                        </tr>
                      )
                    })}
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
