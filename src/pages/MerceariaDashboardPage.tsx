import { useEffect, useState } from 'react'
import { fetchMerceariaDashboard, type MerceariaDashboard, type MerceariaPeriod } from '../lib/merceariaDashboard'
import { ApiError } from '../lib/api'
import { formatCurrency, formatPercent } from '../lib/format'
import { BarChart } from '../components/charts/BarChart'
import { AlertTriangleIcon } from '../components/icons'
import { getPersonName, type AuthCompany, type AuthSession } from '../lib/auth'

interface MerceariaDashboardPageProps {
  niche?: string
  session: AuthSession
  company: AuthCompany
  onOpenProducts?: () => void
  onOpenPayables?: () => void
  onOpenStock?: () => void
}

const PERIOD_OPTIONS: { key: MerceariaPeriod; label: string; compare: string }[] = [
  { key: 'today', label: 'Hoje', compare: 'vs. ontem' },
  { key: '7d', label: '7 dias', compare: 'vs. 7 dias anteriores' },
  { key: 'month', label: 'Este mês', compare: 'vs. mês passado' },
]

function Variation({ value, label }: { value: number; label: string }) {
  if (!Number.isFinite(value) || value === 0) {
    return <span className="text-[11.5px] text-[var(--muted)]">igual {label}</span>
  }
  const up = value > 0
  return (
    <span className={`text-[11.5px] font-semibold ${up ? 'text-[var(--green-600)]' : 'text-[var(--red-500)]'}`}>
      {up ? '▲' : '▼'} {formatPercent(Math.abs(value))} <span className="font-normal text-[var(--muted)]">{label}</span>
    </span>
  )
}

function shortTime(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Cuiaba' })
}

// Painel da mercearia: vendas do período contra o anterior, formas de pagamento, mais vendidos e o
// que pede atenção (produtos sem preço, contas vencidas).
export function MerceariaDashboardPage({
  niche = 'Mercearia',
  session,
  company,
  onOpenProducts,
  onOpenPayables,
  onOpenStock,
}: MerceariaDashboardPageProps) {
  const [period, setPeriod] = useState<MerceariaPeriod>('today')
  const [data, setData] = useState<MerceariaDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchMerceariaDashboard(session.token.token, company.id, period)
      .then((res) => {
        if (!cancelled) setData(res)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Não foi possível carregar o painel.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [session.token.token, company.id, period])

  const compare = PERIOD_OPTIONS.find((option) => option.key === period)?.compare ?? ''
  const summary = data?.summary
  const cards = summary
    ? [
        { label: 'Faturamento', value: formatCurrency(summary.revenue), change: summary.revenueChange },
        { label: 'Vendas', value: String(summary.salesCount), change: summary.salesCountChange },
        { label: 'Ticket médio', value: formatCurrency(summary.averageTicket), change: summary.averageTicketChange },
        {
          label: 'Itens vendidos',
          value: summary.itemsSold.toLocaleString('pt-BR', { maximumFractionDigits: 1 }),
          change: summary.itemsSoldChange,
        },
      ]
    : []

  const attention = data?.attention
  const alerts: { key: string; text: string; tone: 'amber' | 'red'; action?: () => void; actionLabel?: string }[] = []
  if (attention) {
    if (attention.productsWithoutPrice > 0) {
      alerts.push({
        key: 'price',
        tone: 'amber',
        text: `${attention.productsWithoutPrice} produto${attention.productsWithoutPrice === 1 ? '' : 's'} sem preço de venda (valor zerado).`,
        action: onOpenProducts,
        actionLabel: 'Ver produtos',
      })
    }
    const stock = attention.stock
    if (stock && stock.negative > 0) {
      alerts.push({
        key: 'stock-negative',
        tone: 'red',
        text: `${stock.negative} ${stock.negative === 1 ? 'item com estoque negativo' : 'itens com estoque negativo'} (vendeu mais do que tinha lançado). Dê entrada ou faça uma contagem.`,
        action: onOpenStock,
        actionLabel: 'Ver estoque',
      })
    }
    if (stock && stock.empty + stock.low > 0) {
      alerts.push({
        key: 'stock-low',
        tone: 'amber',
        text: `${stock.empty + stock.low} ${stock.empty + stock.low === 1 ? 'item com estoque baixo ou zerado' : 'itens com estoque baixo ou zerado'}.`,
        action: onOpenStock,
        actionLabel: 'Ver estoque',
      })
    }
    if (attention.payables.overdueCount > 0) {
      alerts.push({
        key: 'overdue',
        tone: 'red',
        text: `${attention.payables.overdueCount} conta${attention.payables.overdueCount === 1 ? '' : 's'} a pagar vencida${attention.payables.overdueCount === 1 ? '' : 's'} (${formatCurrency(attention.payables.overdueTotal)}).`,
        action: onOpenPayables,
        actionLabel: 'Ver contas',
      })
    }
    if (attention.payables.todayCount > 0) {
      alerts.push({
        key: 'today',
        tone: 'amber',
        text: `${attention.payables.todayCount} conta${attention.payables.todayCount === 1 ? '' : 's'} a pagar vence${attention.payables.todayCount === 1 ? '' : 'm'} hoje (${formatCurrency(attention.payables.todayTotal)}).`,
        action: onOpenPayables,
        actionLabel: 'Ver contas',
      })
    }
    if (attention.receivablesOverdue.count > 0) {
      alerts.push({
        key: 'receivable',
        tone: 'amber',
        text: `${attention.receivablesOverdue.count} conta${attention.receivablesOverdue.count === 1 ? '' : 's'} a receber em atraso (${formatCurrency(attention.receivablesOverdue.total)}).`,
      })
    }
  }

  const maxProduct = Math.max(1, ...(data?.topProducts ?? []).map((item) => item.quantity))
  const maxCategory = Math.max(1, ...(data?.categories ?? []).map((item) => item.total))

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Dashboard · {niche}</p>
          <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">Olá, {getPersonName(session.user)}</h1>
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

      {alerts.length > 0 && (
        <div className="flex flex-col gap-2">
          {alerts.map((alert) => (
            <div
              key={alert.key}
              className={`flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-2.5 text-[13px] font-semibold ${
                alert.tone === 'red' ? 'bg-[var(--red-100)] text-[var(--red-500)]' : 'bg-[var(--amber-100)] text-[var(--amber-500)]'
              }`}
            >
              <span className="flex items-center gap-2">
                <AlertTriangleIcon className="h-4 w-4 flex-none" />
                {alert.text}
              </span>
              {alert.action && (
                <button type="button" onClick={alert.action} className="rounded-lg bg-white/70 px-3 py-1 text-[12px] font-bold hover:bg-white">
                  {alert.actionLabel}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className={`grid gap-3 sm:grid-cols-2 xl:grid-cols-4 ${loading ? 'opacity-60' : ''}`}>
        {(cards.length ? cards : Array.from({ length: 4 }).map(() => null)).map((card, index) => (
          <div key={card?.label ?? index} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            {card ? (
              <>
                <p className="text-[12px] font-semibold text-[var(--ink-soft)]">{card.label}</p>
                <p className="mt-1 text-[26px] font-bold tracking-tight text-[var(--ink)]">{card.value}</p>
                <div className="mt-1">
                  <Variation value={card.change} label={compare} />
                </div>
              </>
            ) : (
              <div className="h-20 animate-pulse rounded-xl bg-[var(--page)]" />
            )}
          </div>
        ))}
      </div>

      <div className={`grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] ${loading ? 'opacity-60' : ''}`}>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="text-[14px] font-bold text-[var(--ink)]">{period === 'today' ? 'Vendas por hora' : 'Vendas por dia'}</h2>
          <p className="mb-2 text-[12px] text-[var(--muted)]">Faturamento {period === 'today' ? 'hoje, hora a hora' : 'em cada dia do período'}</p>
          <BarChart data={(data?.chart ?? []).map((point) => ({ label: point.label, value: point.total }))} formatValue={formatCurrency} />
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="text-[14px] font-bold text-[var(--ink)]">Formas de pagamento</h2>
          <p className="mb-3 text-[12px] text-[var(--muted)]">Como o período foi pago</p>
          {data && data.payments.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-[var(--muted)]">Nenhuma venda no período.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {(data?.payments ?? []).map((payment) => (
                <div key={payment.formPayment} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[12.5px]">
                    <span className="text-[var(--ink-soft)]">{payment.label}</span>
                    <span className="font-semibold text-[var(--ink)]">
                      {formatCurrency(payment.total)} <span className="font-normal text-[var(--muted)]">· {formatPercent(payment.percent)}</span>
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--page)]">
                    <div className="h-full rounded-full bg-[var(--blue-500)]" style={{ width: `${payment.percent}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={`grid gap-4 lg:grid-cols-2 ${loading ? 'opacity-60' : ''}`}>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="text-[14px] font-bold text-[var(--ink)]">Mais vendidos</h2>
          <p className="mb-3 text-[12px] text-[var(--muted)]">Por quantidade no período</p>
          {data && data.topProducts.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-[var(--muted)]">Nenhuma venda no período.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {(data?.topProducts ?? []).map((product) => (
                <div key={product.name} className="flex items-center gap-3">
                  <span className="w-[42%] flex-none truncate text-[12.5px] text-[var(--ink-soft)]" title={product.name}>
                    {product.name}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--page)]">
                    <div className="h-full rounded-full bg-[var(--green-600)]" style={{ width: `${(product.quantity / maxProduct) * 100}%` }} />
                  </div>
                  <span className="w-24 flex-none text-right text-[12.5px] font-semibold text-[var(--ink)]">
                    {product.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} un
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="text-[14px] font-bold text-[var(--ink)]">Categorias</h2>
          <p className="mb-3 text-[12px] text-[var(--muted)]">Faturamento por categoria</p>
          {data && data.categories.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-[var(--muted)]">Nenhuma venda no período.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {(data?.categories ?? []).map((category) => (
                <div key={category.name} className="flex items-center gap-3">
                  <span className="w-[42%] flex-none truncate text-[12.5px] text-[var(--ink-soft)]">{category.name}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--page)]">
                    <div className="h-full rounded-full bg-[var(--amber-500)]" style={{ width: `${(category.total / maxCategory) * 100}%` }} />
                  </div>
                  <span className="w-24 flex-none text-right text-[12.5px] font-semibold text-[var(--ink)]">{formatCurrency(category.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="text-[14px] font-bold text-[var(--ink)]">Últimas vendas</h2>
        <p className="mb-3 text-[12px] text-[var(--muted)]">As 8 vendas mais recentes</p>
        {data && data.recentSales.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-[var(--muted)]">Nenhuma venda ainda.</p>
        ) : (
          <div className="flex flex-col divide-y divide-[var(--border)]">
            {(data?.recentSales ?? []).map((sale) => (
              <div key={sale.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-[var(--ink)]">Venda #{sale.code}</p>
                  <p className="text-[12px] text-[var(--muted)]">
                    {shortTime(sale.date)} · {sale.itemsCount.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} iten
                    {sale.itemsCount === 1 ? '' : 's'} · {sale.formPaymentLabel}
                  </p>
                </div>
                <span className="flex-none text-[13px] font-bold text-[var(--ink)]">{formatCurrency(sale.total)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
