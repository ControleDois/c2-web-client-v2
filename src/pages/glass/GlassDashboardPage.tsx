import { useEffect, useState } from 'react'
import {
  agendaDateKey,
  agendaTime,
  fetchGlassDashboard,
  generateMissingGlassBills,
  GLASS_APPOINTMENT_TYPES,
  GLASS_ORDER_STATUS_LABELS,
  GLASS_STAGE_LABELS,
  type GlassDashboard,
  type GlassDashboardMonth,
} from '../../lib/glass'
import { ApiError } from '../../lib/api'
import { formatCurrency, formatPercent } from '../../lib/format'
import { GlassStatusBadge } from './GlassOrdersPage'
import { BellIcon, FileTextIcon, PlusIcon, TagIcon, UserIcon } from '../../components/icons'
import { getPersonName, type AuthCompany, type AuthSession } from '../../lib/auth'

interface GlassDashboardPageProps {
  session: AuthSession
  company: AuthCompany
  onNewQuote?: () => void
  onNewClient?: () => void
  onOpenOrders?: () => void
  onOpenModels?: () => void
  onOpenOrder?: (orderId: string) => void
  onOpenSchedule?: () => void
}

// Variação contra o mesmo trecho do mês passado. Sem base de comparação, não mostra percentual.
function variation(current: number, previous: number) {
  if (!previous) return null
  return ((current - previous) / previous) * 100
}

function VariationLabel({ current, previous, higherIsBad = false }: { current: number; previous: number; higherIsBad?: boolean }) {
  const percent = variation(current, previous)
  if (percent === null) {
    return <span className="text-[11.5px] text-[var(--muted)]">{current ? 'sem base no mês passado' : 'sem movimento'}</span>
  }
  const up = percent >= 0
  const good = higherIsBad ? !up : up
  return (
    <span className={`text-[11.5px] font-semibold ${percent === 0 ? 'text-[var(--muted)]' : good ? 'text-[var(--green-600)]' : 'text-[var(--red-500)]'}`}>
      {up ? '▲' : '▼'} {formatPercent(Math.abs(percent))} <span className="font-normal text-[var(--muted)]">vs. mês passado</span>
    </span>
  )
}

function Donut({ slices }: { slices: { label: string; value: number; color: string }[] }) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0)
  const radius = 54
  const circumference = 2 * Math.PI * radius
  let offset = 0
  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg viewBox="0 0 140 140" className="h-36 w-36 flex-none -rotate-90">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="var(--page)" strokeWidth="22" />
        {total > 0 &&
          slices
            .filter((slice) => slice.value > 0)
            .map((slice) => {
              const length = (slice.value / total) * circumference
              const circle = (
                <circle
                  key={slice.label}
                  cx="70"
                  cy="70"
                  r={radius}
                  fill="none"
                  stroke={slice.color}
                  strokeWidth="22"
                  strokeDasharray={`${length} ${circumference - length}`}
                  strokeDashoffset={-offset}
                />
              )
              offset += length
              return circle
            })}
      </svg>
      <div className="flex flex-col gap-2">
        {slices.map((slice) => (
          <div key={slice.label} className="flex items-center gap-2 text-[12.5px]">
            <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: slice.color }} />
            <span className="text-[var(--ink-soft)]">{slice.label}</span>
            <span className="font-semibold text-[var(--ink)]">{slice.value}</span>
          </div>
        ))}
        {total === 0 && <span className="text-[12px] text-[var(--muted)]">Sem movimento no mês.</span>}
      </div>
    </div>
  )
}

function SalesBars({ days }: { days: GlassDashboardMonth['daily_sales'] }) {
  const max = Math.max(1, ...days.map((day) => day.total))
  const hasSales = days.some((day) => day.total > 0)
  return (
    <div>
      <div className="flex h-36 items-end gap-[3px]">
        {days.map((day) => (
          <div key={day.date} className="group relative flex h-full flex-1 items-end" title={`${day.date.slice(8, 10)}/${day.date.slice(5, 7)} · ${formatCurrency(day.total)} · ${day.count} venda(s)`}>
            <div
              className={`w-full rounded-t ${day.total > 0 ? 'bg-[var(--blue-500)]' : 'bg-[var(--page)]'}`}
              style={{ height: day.total > 0 ? `${Math.max((day.total / max) * 100, 4)}%` : '3px' }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[10.5px] text-[var(--muted)]">
        <span>{days[0] ? `${days[0].date.slice(8, 10)}/${days[0].date.slice(5, 7)}` : ''}</span>
        <span>{hasSales ? `maior dia: ${formatCurrency(max)}` : 'nenhuma venda no mês'}</span>
        <span>{days.length ? `${days[days.length - 1].date.slice(8, 10)}/${days[days.length - 1].date.slice(5, 7)}` : ''}</span>
      </div>
    </div>
  )
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

export function GlassDashboardPage({ session, company, onNewQuote, onNewClient, onOpenOrders, onOpenModels, onOpenOrder, onOpenSchedule }: GlassDashboardPageProps) {
  const [period, setPeriod] = useState<PeriodKey>('all')
  const [data, setData] = useState<GlassDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [generating, setGenerating] = useState(false)
  const [billingNotice, setBillingNotice] = useState<string | null>(null)

  async function handleGenerateMissingBills() {
    setGenerating(true)
    setBillingNotice(null)
    try {
      const result = await generateMissingGlassBills(session.token.token, company.id)
      const parts: string[] = []
      if (result.generated > 0) parts.push(`${result.generated} venda${result.generated === 1 ? '' : 's'} com contas a receber geradas.`)
      for (const skipped of result.skipped) parts.push(`Pedido #${skipped.code}: ${skipped.reason}`)
      setBillingNotice(parts.join(' ') || 'Nada a gerar.')
      setReloadKey((key) => key + 1)
    } catch (err) {
      setBillingNotice(err instanceof ApiError ? err.message : 'Não foi possível gerar as contas a receber.')
    } finally {
      setGenerating(false)
    }
  }

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
  }, [session.token.token, company.id, period, reloadKey])

  const kpis = data?.kpis
  const cards = kpis
    ? [
        { label: 'Orçamentos em aberto', value: String(kpis.open_quotes_count), sub: formatCurrency(kpis.open_quotes_total) },
        { label: 'Vendas aprovadas', value: formatCurrency(kpis.sales_total), sub: `${kpis.sales_count} venda${kpis.sales_count === 1 ? '' : 's'}` },
        { label: 'Ticket médio', value: formatCurrency(kpis.average_ticket), sub: 'por venda aprovada' },
        { label: 'Taxa de conversão', value: formatPercent(kpis.conversion_percent), sub: 'aprovados / criados' },
        { label: 'Recebido', value: formatCurrency(kpis.received), sub: 'parcelas já pagas' },
        { label: 'A receber', value: formatCurrency(kpis.receivable), sub: 'parcelas em aberto' },
        { label: 'Em atraso', value: formatCurrency(kpis.overdue), sub: 'parcelas vencidas', alert: kpis.overdue > 0 },
        {
          label: 'Visitas hoje',
          value: String(data?.visits.today ?? 0),
          sub: data && data.visits.overdue > 0 ? `${data.visits.overdue} atrasada${data.visits.overdue === 1 ? '' : 's'}` : 'agendadas para hoje',
          alert: Boolean(data && data.visits.overdue > 0),
        },
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

      {data && (data.visits.today > 0 || data.visits.overdue > 0) && (
        <div
          role="alert"
          className={`flex flex-wrap items-center gap-4 rounded-2xl border p-4 ${
            data.visits.overdue > 0
              ? 'border-[var(--red-500)] bg-[var(--red-100)]'
              : 'border-[var(--amber-500)] bg-[var(--amber-100)]'
          }`}
        >
          <span className="relative flex h-10 w-10 flex-none items-center justify-center">
            <span
              className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${
                data.visits.overdue > 0 ? 'bg-[var(--red-500)]' : 'bg-[var(--amber-500)]'
              }`}
            />
            <span
              className={`relative flex h-10 w-10 items-center justify-center rounded-full text-white ${
                data.visits.overdue > 0 ? 'bg-[var(--red-500)]' : 'bg-[var(--amber-500)]'
              }`}
            >
              <BellIcon className="h-5 w-5 animate-pulse" />
            </span>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14.5px] font-bold text-[var(--ink)]">
              {data.visits.today > 0 &&
                `${data.visits.today} ${data.visits.today === 1 ? 'visita técnica hoje' : 'visitas técnicas hoje'}`}
              {data.visits.today > 0 && data.visits.overdue > 0 && ' · '}
              {data.visits.overdue > 0 &&
                `${data.visits.overdue} ${data.visits.overdue === 1 ? 'visita atrasada' : 'visitas atrasadas'}`}
            </p>
            <p className="text-[12.5px] text-[var(--ink-soft)]">
              {data.visits.overdue > 0
                ? 'Visitas que já passaram e não foram concluídas. Abra a agenda para concluir ou reagendar.'
                : 'Confira o horário e o endereço na agenda antes de sair.'}
            </p>
          </div>
          {onOpenSchedule && (
            <button
              type="button"
              onClick={onOpenSchedule}
              className="rounded-xl bg-[var(--blue-500)] px-4 py-2.5 text-[13px] font-bold text-white hover:bg-[var(--blue-700)]"
            >
              Ver agenda
            </button>
          )}
        </div>
      )}

      {data && data.kpis.sales_without_bills_count > 0 && (
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-[var(--amber-500)] bg-[var(--amber-100)] p-4">
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-bold text-[var(--ink)]">
              {data.kpis.sales_without_bills_count}{' '}
              {data.kpis.sales_without_bills_count === 1 ? 'venda aprovada ainda sem' : 'vendas aprovadas ainda sem'} contas a receber (
              {formatCurrency(data.kpis.sales_without_bills_total)})
            </p>
            <p className="text-[12.5px] text-[var(--ink-soft)]">
              Enquanto as parcelas não existem, o valor não aparece em “A receber” nem no financeiro. Se faltar o cliente ou a
              categoria no pedido, o sistema avisa qual pedido ajustar.
            </p>
            {billingNotice && <p className="mt-1 text-[12.5px] font-semibold text-[var(--ink)]">{billingNotice}</p>}
          </div>
          <button
            type="button"
            disabled={generating}
            onClick={handleGenerateMissingBills}
            className="rounded-xl bg-[var(--blue-500)] px-4 py-2.5 text-[13px] font-bold text-white hover:bg-[var(--blue-700)] disabled:opacity-60"
          >
            {generating ? 'Gerando…' : 'Gerar contas a receber'}
          </button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Novo orçamento', icon: <PlusIcon className="h-6 w-6" />, onClick: onNewQuote },
          { label: 'Novo cliente', icon: <UserIcon className="h-6 w-6" />, onClick: onNewClient },
          { label: 'Orçamentos e vendas', icon: <FileTextIcon className="h-6 w-6" />, onClick: onOpenOrders },
          { label: 'Modelos e projetos', icon: <TagIcon className="h-6 w-6" />, onClick: onOpenModels },
        ]
          .filter((action) => action.onClick)
          .map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              className="flex flex-col items-center gap-2 rounded-2xl bg-[var(--ink)] px-4 py-5 text-[12.5px] font-bold tracking-wide text-white uppercase transition hover:opacity-90"
            >
              {action.icon}
              {action.label}
            </button>
          ))}
      </div>

      {data?.month && (
        <div className={`flex flex-col gap-4 ${loading ? 'opacity-60' : ''}`}>
          <div>
            <h2 className="text-[14px] font-bold text-[var(--ink)] capitalize">{data.month.label}</h2>
            <p className="text-[12px] text-[var(--muted)]">Do dia 1 até hoje, comparado ao mesmo trecho do mês passado</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: 'Vendas',
                value: String(data.month.sales.count),
                sub: formatCurrency(data.month.sales.total),
                current: data.month.sales.total,
                previous: data.month.sales.prev_total,
              },
              { label: 'Orçamentos', value: String(data.month.quotes.count), sub: 'criados no mês', current: data.month.quotes.count, previous: data.month.quotes.prev },
              { label: 'Clientes novos', value: String(data.month.new_clients.count), sub: 'cadastrados no mês', current: data.month.new_clients.count, previous: data.month.new_clients.prev },
              { label: 'Cancelados', value: String(data.month.canceled.count), sub: 'pedidos cancelados', current: data.month.canceled.count, previous: data.month.canceled.prev, bad: true },
            ].map((card) => (
              <div key={card.label} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
                <p className="text-[12px] font-semibold text-[var(--ink-soft)]">{card.label}</p>
                <p className="mt-1 text-[26px] font-bold tracking-tight text-[var(--ink)]">{card.value}</p>
                <p className="text-[12px] text-[var(--muted)]">{card.sub}</p>
                <div className="mt-1.5">
                  <VariationLabel current={card.current} previous={card.previous} higherIsBad={card.bad} />
                </div>
              </div>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <h3 className="text-[14px] font-bold text-[var(--ink)]">Orçamentos x vendas</h3>
              <p className="mb-3 text-[12px] text-[var(--muted)]">No mês, em quantidade de pedidos</p>
              <Donut
                slices={[
                  { label: 'Orçamentos', value: data.month.quotes.count, color: 'var(--blue-500)' },
                  { label: 'Vendas', value: data.month.sales.count, color: 'var(--green-600)' },
                  { label: 'Cancelados', value: data.month.canceled.count, color: 'var(--red-500)' },
                ]}
              />
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <h3 className="text-[14px] font-bold text-[var(--ink)]">Vendas por dia</h3>
              <p className="mb-3 text-[12px] text-[var(--muted)]">Valor das vendas aprovadas em cada dia do mês</p>
              <SalesBars days={data.month.daily_sales} />
            </div>
          </div>
        </div>
      )}

      {error && <div className="rounded-2xl bg-[var(--red-100)] p-4 text-[13.5px] font-medium text-[var(--red-500)]">{error}</div>}

      <div className={`grid gap-3 sm:grid-cols-2 xl:grid-cols-4 ${loading ? 'opacity-60' : ''}`}>
        {(cards.length ? cards : Array.from({ length: 8 }).map(() => null)).map((card, index) => (
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
                      {[appointment.order ? `#${appointment.order.code}` : null, appointment.responsible?.name ?? appointment.team, appointment.address].filter(Boolean).join(' · ')}
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
                <div
                  key={order.id}
                  className={`flex items-center justify-between gap-3 py-2.5 ${onOpenOrder ? 'cursor-pointer hover:bg-[var(--page)]' : ''}`}
                  onClick={() => onOpenOrder?.(order.id)}
                >
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
