import { useEffect, useState } from 'react'
import {
  agendaDateKey,
  agendaTime,
  fetchGlassDashboard,
  GLASS_APPOINTMENT_TYPES,
  GLASS_ORDER_STATUS_LABELS,
  GLASS_STAGE_LABELS,
  type GlassDashboard,
} from '../../lib/glass'
import { ApiError } from '../../lib/api'
import { formatCurrency, formatPercent } from '../../lib/format'
import { GlassStatusBadge } from './GlassOrdersPage'
import { getPersonName, type AuthCompany, type AuthSession } from '../../lib/auth'

interface GlassDashboardPageProps {
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

// Ordem do funil: do orçamento até o faturamento (cancelado por último).
const FUNNEL_ORDER = [0, 1, 2, 3, 4, 5, 8]

function dayLabel(iso: string) {
  const [, month, day] = agendaDateKey(iso).split('-')
  return `${day}/${month}`
}

export function GlassDashboardPage({ session, company }: GlassDashboardPageProps) {
  const [period, setPeriod] = useState<PeriodKey>('all')
  const [data, setData] = useState<GlassDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchGlassDashboard(session.token.token, company.id, period)
      .then((res) => {
        if (!cancelled) setData(res)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Não foi possível carregar o dashboard.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [session.token.token, company.id, period])

  const kpis = data?.kpis
  const cards = kpis
    ? [
        { label: 'Orçamentos em aberto', value: String(kpis.open_quotes_count), sub: formatCurrency(kpis.open_quotes_total) },
        { label: 'Vendas aprovadas', value: formatCurrency(kpis.sales_total), sub: `${kpis.sales_count} venda${kpis.sales_count === 1 ? '' : 's'}` },
        { label: 'Ticket médio', value: formatCurrency(kpis.average_ticket), sub: 'por venda aprovada' },
        { label: 'Taxa de conversão', value: formatPercent(kpis.conversion_percent), sub: 'aprovados / criados' },
        { label: 'A receber', value: formatCurrency(kpis.receivable), sub: 'parcelas em aberto' },
        { label: 'Em atraso', value: formatCurrency(kpis.overdue), sub: 'parcelas vencidas', alert: kpis.overdue > 0 },
      ]
    : []

  const funnelMax = Math.max(1, ...FUNNEL_ORDER.map((status) => data?.by_status[status]?.count ?? 0))
  const stageMax = Math.max(1, ...Object.values(data?.stages ?? {}), 1)
  const typeLabel = (value: string) => GLASS_APPOINTMENT_TYPES.find((item) => item.value === value)?.label ?? value

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Dashboard · Vidraçaria</p>
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
                period === option.key ? 'bg-[var(--blue-500)] text-white' : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="rounded-2xl bg-[var(--red-100)] p-4 text-[13.5px] font-medium text-[var(--red-500)]">{error}</div>}

      <div className={`grid gap-3 sm:grid-cols-2 xl:grid-cols-3 ${loading ? 'opacity-60' : ''}`}>
        {(cards.length ? cards : Array.from({ length: 6 }).map(() => null)).map((card, index) => (
          <div key={card?.label ?? index} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            {card ? (
              <>
                <p className="text-[12px] font-semibold text-[var(--ink-soft)]">{card.label}</p>
                <p className={`mt-1 text-[24px] font-bold tracking-tight ${card.alert ? 'text-[var(--red-500)]' : 'text-[var(--ink)]'}`}>{card.value}</p>
                <p className="text-[12px] text-[var(--muted)]">{card.sub}</p>
              </>
            ) : (
              <div className="h-16 animate-pulse rounded-xl bg-[var(--page)]" />
            )}
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="text-[14px] font-bold text-[var(--ink)]">Funil de pedidos</h2>
          <p className="mb-3 text-[12px] text-[var(--muted)]">Pedidos criados no período, por situação</p>
          <div className="flex flex-col gap-2.5">
            {FUNNEL_ORDER.map((status) => {
              const entry = data?.by_status[status]
              const count = entry?.count ?? 0
              return (
                <div key={status} className="flex items-center gap-3">
                  <span className="w-24 flex-none text-[12.5px] text-[var(--ink-soft)]">{GLASS_ORDER_STATUS_LABELS[status]}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--page)]">
                    <div
                      className={`h-full rounded-full ${status === 8 ? 'bg-[var(--red-500)]' : 'bg-[var(--blue-500)]'}`}
                      style={{ width: `${(count / funnelMax) * 100}%` }}
                    />
                  </div>
                  <span className="w-28 flex-none text-right text-[12.5px] font-semibold text-[var(--ink)]">
                    {count}
                    <span className="ml-1 font-normal text-[var(--muted)]">{count ? formatCurrency(entry?.total ?? 0) : ''}</span>
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="text-[14px] font-bold text-[var(--ink)]">Produção</h2>
          <p className="mb-3 text-[12px] text-[var(--muted)]">Itens dos pedidos aprovados, por estágio</p>
          <div className="flex flex-col gap-2.5">
            {Object.entries(GLASS_STAGE_LABELS).map(([stage, label]) => {
              const count = data?.stages[stage] ?? 0
              return (
                <div key={stage} className="flex items-center gap-3">
                  <span className="w-36 flex-none text-[12.5px] text-[var(--ink-soft)]">{label}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--page)]">
                    <div className="h-full rounded-full bg-[var(--green-600)]" style={{ width: `${(count / stageMax) * 100}%` }} />
                  </div>
                  <span className="w-8 flex-none text-right text-[12.5px] font-semibold text-[var(--ink)]">{count}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="text-[14px] font-bold text-[var(--ink)]">Próximas visitas</h2>
          <p className="mb-3 text-[12px] text-[var(--muted)]">Medições, instalações e entregas agendadas</p>
          {data && data.upcoming.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-[var(--muted)]">Nenhuma visita agendada.</p>
          ) : (
            <div className="flex flex-col divide-y divide-[var(--border)]">
              {(data?.upcoming ?? []).map((appointment) => (
                <div key={appointment.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-[var(--ink)]">
                      {typeLabel(appointment.type)} · {appointment.people?.name ?? appointment.order?.people?.name ?? 'Sem cliente'}
                    </p>
                    <p className="truncate text-[12px] text-[var(--muted)]">
                      {[appointment.order ? `#${appointment.order.code}` : null, appointment.team, appointment.address].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <span className="flex-none text-[12.5px] font-semibold text-[var(--ink-soft)]">
                    {dayLabel(appointment.scheduled_at)} {agendaTime(appointment.scheduled_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="text-[14px] font-bold text-[var(--ink)]">Pedidos recentes</h2>
          <p className="mb-3 text-[12px] text-[var(--muted)]">Os 8 lançamentos mais recentes</p>
          {data && data.recent.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-[var(--muted)]">Nenhum pedido ainda.</p>
          ) : (
            <div className="flex flex-col divide-y divide-[var(--border)]">
              {(data?.recent ?? []).map((order) => (
                <div key={order.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-[var(--ink)]">
                      #{order.code} · {order.people?.name ?? 'Sem cliente'}
                    </p>
                    <p className="truncate text-[12px] text-[var(--muted)]">{order.reference || '—'}</p>
                  </div>
                  <div className="flex flex-none items-center gap-2">
                    <GlassStatusBadge status={order.status} />
                    <span className="text-[12.5px] font-semibold text-[var(--ink)]">{formatCurrency(order.total)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
