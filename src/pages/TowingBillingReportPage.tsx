import { useEffect, useState } from 'react'
import {
  fetchTowingNetRevenue,
  openTowingNetRevenuePdf,
  type TowingRevenueReport,
  type TowingRevenueStatusFilter,
} from '../lib/reports'
import { ApiError } from '../lib/api'
import { formatCurrency, formatDate, formatPercent } from '../lib/format'
import { MultiSeriesBarChart } from '../components/charts/MultiSeriesBarChart'
import { PrinterIcon, TrendUpIcon, TruckIcon, CoinIcon, RouteIcon, ChevronDownIcon } from '../components/icons'
import type { AuthSession, AuthCompany } from '../lib/auth'

interface TowingBillingReportPageProps {
  session: AuthSession
  company: AuthCompany
}

const STATUS_OPTIONS: { value: TowingRevenueStatusFilter; label: string }[] = [
  { value: 'billable', label: 'Vendas não canceladas' },
  { value: 'signed', label: 'Somente assinadas' },
  { value: 'all', label: 'Todas as vendas' },
  { value: 'canceled', label: 'Somente canceladas' },
]

const TOWING_SALE_STATUS_LABELS: Record<number, string> = {
  0: 'Em orçamento',
  1: 'Contrato gerado',
  2: 'Aguardando assinatura',
  3: 'Assinado',
  4: 'Cancelado',
  5: 'Concluído',
}

const COLLECTION_STATUS_DELIVERED = 4

function todayISO(offsetDays = 0) {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  return date.toISOString().slice(0, 10)
}

function firstDayOfMonthISO() {
  const date = new Date()
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().slice(0, 10)
}

function lastDayOfMonthISO() {
  const date = new Date()
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().slice(0, 10)
}

function saleCustomerName(sale: TowingRevenueReport['sales'][number]) {
  return sale.people?.name || sale.people?.social_name || 'Cliente não informado'
}

function saleVehicleLabel(sale: TowingRevenueReport['sales'][number]) {
  const vehicle = sale.vehicle
  const name = [vehicle?.brand, vehicle?.model].filter(Boolean).join(' ')
  return name || 'Veículo não informado'
}

function saleRoute(sale: TowingRevenueReport['sales'][number]) {
  const origin = sale.origin_city || sale.origin_address || 'Origem não informada'
  const destination = sale.destination_city || sale.destination_address || 'Destino não informado'
  return `${origin} → ${destination}`
}

export function TowingBillingReportPage({ session, company }: TowingBillingReportPageProps) {
  const [dateStart, setDateStart] = useState(firstDayOfMonthISO)
  const [dateEnd, setDateEnd] = useState(lastDayOfMonthISO)
  const [status, setStatus] = useState<TowingRevenueStatusFilter>('billable')
  const [showExpenses, setShowExpenses] = useState(false)
  const [report, setReport] = useState<TowingRevenueReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)

  useEffect(() => {
    if (!dateStart || !dateEnd || dateStart > dateEnd) return
    let cancelled = false
    setLoading(true)
    setError(null)

    fetchTowingNetRevenue(session.token.token, company.id, { dateStart, dateEnd, status })
      .then((res) => {
        if (cancelled) return
        setReport(res)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof ApiError ? err.message : 'Não foi possível carregar o relatório de faturamento.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [dateStart, dateEnd, status, company.id, session.token.token])

  const sales = report?.sales ?? []
  const summary = report?.summary
  const salesCount = summary?.sales_count ?? 0
  const averageTicket = salesCount ? (summary?.gross_revenue ?? 0) / salesCount : 0
  const deliveredCount = sales.filter((sale) => sale.collection_status === COLLECTION_STATUS_DELIVERED).length
  const deliveryRate = salesCount ? (deliveredCount / salesCount) * 100 : 0

  const chartData = (() => {
    const days = new Map<string, { gross: number; expenses: number }>()
    const cursor = new Date(`${dateStart}T00:00:00`)
    const last = new Date(`${dateEnd}T00:00:00`)
    while (!Number.isNaN(cursor.getTime()) && !Number.isNaN(last.getTime()) && cursor <= last) {
      days.set(cursor.toISOString().slice(0, 10), { gross: 0, expenses: 0 })
      cursor.setDate(cursor.getDate() + 1)
    }
    for (const sale of sales) {
      const key = sale.created_at?.slice(0, 10)
      if (!key) continue
      const totals = days.get(key) ?? { gross: 0, expenses: 0 }
      totals.gross += sale.transport_value
      totals.expenses += sale.total_expenses
      days.set(key, totals)
    }
    const entries = Array.from(days.entries()).sort(([a], [b]) => a.localeCompare(b))
    return {
      labels: entries.map(([date]) => date.slice(5).split('-').reverse().join('/')),
      gross: entries.map(([, total]) => total.gross),
      expenses: entries.map(([, total]) => total.expenses),
      net: entries.map(([, total]) => total.gross - total.expenses),
    }
  })()

  async function handleGeneratePdf() {
    setGeneratingPdf(true)
    setPdfError(null)
    try {
      await openTowingNetRevenuePdf(session.token.token, company.id, { dateStart, dateEnd, status, showExpenses })
    } catch (err) {
      setPdfError(err instanceof ApiError ? err.message : 'Não foi possível gerar o PDF do relatório.')
    } finally {
      setGeneratingPdf(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-8 print:gap-2.5 print:p-0">
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div>
          <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Relatórios</p>
          <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">Faturamento</h1>
          <p className="mt-1 text-[13px] text-[var(--muted)]">Faturamento de guinchos, gastos vinculados e resultado líquido por período.</p>
        </div>
        <button
          type="button"
          onClick={handleGeneratePdf}
          disabled={generatingPdf}
          className="print-hide flex items-center gap-2 rounded-xl border border-[var(--border)] px-4 py-2.5 text-[13px] font-semibold text-[var(--ink-soft)] transition hover:bg-[var(--page)] disabled:opacity-60"
        >
          <PrinterIcon className="h-4 w-4" />
          {generatingPdf ? 'Gerando PDF…' : 'Imprimir'}
        </button>
      </div>

      {pdfError && (
        <div className="print-hide rounded-2xl bg-[var(--red-100)] p-4 text-[13.5px] font-medium text-[var(--red-500)]">
          {pdfError}
        </div>
      )}

      <div className="print-hide flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-[12.5px] font-semibold text-[var(--ink-soft)]">De</label>
          <input
            type="date"
            value={dateStart}
            max={dateEnd}
            onChange={(event) => setDateStart(event.target.value)}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--ink)] focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[12.5px] font-semibold text-[var(--ink-soft)]">Até</label>
          <input
            type="date"
            value={dateEnd}
            min={dateStart}
            max={todayISO(365)}
            onChange={(event) => setDateEnd(event.target.value)}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--ink)] focus:outline-none"
          />
        </div>
        <div className="relative flex items-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as TowingRevenueStatusFilter)}
            className="appearance-none bg-transparent pr-5 text-[13px] font-semibold text-[var(--ink-soft)] focus:outline-none"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDownIcon className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-[var(--muted)]" />
        </div>

        <label className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-[13px] font-semibold text-[var(--ink-soft)]">
          <input
            type="checkbox"
            checked={showExpenses}
            onChange={(event) => setShowExpenses(event.target.checked)}
            className="h-3.5 w-3.5 accent-[var(--blue-500)]"
          />
          Mostrar gastos
        </label>
      </div>

      {error && (
        <div className="rounded-2xl bg-[var(--red-100)] p-4 text-[13.5px] font-medium text-[var(--red-500)]">{error}</div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 print:hidden xl:grid-cols-6">
        {[
          { label: 'Faturamento bruto', value: formatCurrency(summary?.gross_revenue ?? 0), icon: CoinIcon },
          { label: 'Gastos vinculados', value: formatCurrency(summary?.total_expenses ?? 0), icon: TruckIcon },
          { label: 'Faturamento líquido', value: formatCurrency(summary?.net_revenue ?? 0), icon: TrendUpIcon },
          { label: 'Guinchos no período', value: String(salesCount), icon: RouteIcon },
          { label: 'Ticket médio', value: formatCurrency(averageTicket), icon: CoinIcon },
          { label: 'Taxa de entrega', value: formatPercent(deliveryRate), icon: TrendUpIcon },
        ].map((tile) => (
          <div key={tile.label} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--blue-100)] text-[var(--blue-700)]">
              <tile.icon className="h-4 w-4" />
            </span>
            <p className="mt-2.5 text-[11px] font-semibold text-[var(--muted)]">{tile.label}</p>
            <p className="mt-0.5 text-[16px] font-bold text-[var(--ink)]">{tile.value}</p>
          </div>
        ))}
      </div>

      <div className="hidden print:grid print:grid-cols-3 print:divide-x print:divide-y print:divide-black/15 print:border print:border-black/25">
        {[
          { label: 'Faturamento bruto', value: formatCurrency(summary?.gross_revenue ?? 0) },
          { label: 'Gastos vinculados', value: formatCurrency(summary?.total_expenses ?? 0) },
          { label: 'Faturamento líquido', value: formatCurrency(summary?.net_revenue ?? 0) },
          { label: 'Guinchos no período', value: String(salesCount) },
          { label: 'Ticket médio', value: formatCurrency(averageTicket) },
          { label: 'Taxa de entrega', value: formatPercent(deliveryRate) },
        ].map((tile) => (
          <div key={tile.label} className="px-3 py-2">
            <p className="text-[8.5px] font-semibold tracking-wide text-black/60 uppercase">{tile.label}</p>
            <p className="mt-0.5 text-[13px] font-bold whitespace-nowrap text-black">{tile.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 print:rounded-none print:border-none print:p-0">
        <h2 className="text-[14px] font-bold text-[var(--ink)] print:text-[11px] print:text-black">Faturamento por dia</h2>
        <p className="text-[12.5px] text-[var(--muted)] print:text-[9px] print:text-black/60">
          Bruto, gastos vinculados e resultado líquido por dia do período
        </p>
        <div className="mt-4 print:mt-2">
          {loading ? (
            <div className="h-52 animate-pulse rounded-xl bg-[var(--page)] print:hidden" />
          ) : (
            <MultiSeriesBarChart
              labels={chartData.labels}
              formatValue={formatCurrency}
              series={[
                { name: 'Faturamento bruto', color: 'var(--blue-500)', data: chartData.gross },
                { name: 'Gastos vinculados', color: 'var(--red-500)', data: chartData.expenses },
                { name: 'Faturamento líquido', color: 'var(--green-600)', data: chartData.net },
              ]}
            />
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 print:rounded-none print:border-none print:p-0">
        <h2 className="text-[14px] font-bold text-[var(--ink)] print:text-[11px] print:text-black">Vendas do período</h2>
        {loading ? (
          <div className="mt-3 flex flex-col gap-2.5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-11 animate-pulse rounded-xl bg-[var(--page)]" />
            ))}
          </div>
        ) : sales.length === 0 ? (
          <p className="py-10 text-center text-[13.5px] text-[var(--muted)]">Nenhuma venda encontrada no período.</p>
        ) : (
          <div className="print-overflow-visible mt-3 overflow-x-auto print:mt-1.5">
            <table className="w-full border-collapse text-[13px] print:border print:border-black/25 print:text-[9px]">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase print:border-b-2 print:border-black print:text-[8px] print:text-black">
                  <th className="py-2.5 pl-3 pr-2 print:border-r print:border-black/15 print:px-1.5 print:py-1">Código</th>
                  <th className="px-2 py-2.5 print:border-r print:border-black/15 print:px-1.5 print:py-1">Data</th>
                  <th className="px-2 py-2.5 print:border-r print:border-black/15 print:px-1.5 print:py-1">Cliente / Veículo</th>
                  <th className="px-2 py-2.5 print:hidden">Rota</th>
                  <th className="px-2 py-2.5 print:border-r print:border-black/15 print:px-1.5 print:py-1">Status</th>
                  <th className="px-2 py-2.5 text-right print:border-r print:border-black/15 print:px-1.5 print:py-1">Bruto</th>
                  <th className="px-2 py-2.5 text-right print:border-r print:border-black/15 print:px-1.5 print:py-1">Gastos</th>
                  <th className="py-2.5 pr-3 pl-2 text-right print:px-1.5 print:py-1">Líquido</th>
                </tr>
              </thead>
              {sales.map((sale, index) => (
                <tbody key={sale.id} className="print-avoid-break">
                  <tr
                    className={`${showExpenses && sale.expenses.length > 0 ? '' : 'border-b border-[var(--border)] last:border-none'} ${
                      index % 2 === 1 ? 'bg-[var(--page)]' : ''
                    } print:border-b print:border-black/15 print:bg-white`}
                  >
                    <td className="py-3 pl-3 pr-2 align-top font-mono text-[var(--ink-soft)] print:border-r print:border-black/10 print:px-1.5 print:py-1 print:text-black">
                      #{sale.code}
                    </td>
                    <td className="px-2 py-3 align-top whitespace-nowrap text-[var(--ink-soft)] print:border-r print:border-black/10 print:px-1.5 print:py-1 print:text-black">
                      {formatDate(sale.created_at)}
                    </td>
                    <td className="px-2 py-3 align-top print:border-r print:border-black/10 print:px-1.5 print:py-1">
                      <p className="font-semibold text-[var(--ink)] print:text-black">{saleCustomerName(sale)}</p>
                      <p className="mt-0.5 text-[12px] text-[var(--muted)] print:text-[8px] print:text-black/60">
                        {saleVehicleLabel(sale)}
                      </p>
                    </td>
                    <td className="px-2 py-3 align-top text-[var(--ink-soft)] print:hidden">{saleRoute(sale)}</td>
                    <td className="px-2 py-3 align-top whitespace-nowrap text-[var(--ink-soft)] print:border-r print:border-black/10 print:px-1.5 print:py-1 print:text-black">
                      {TOWING_SALE_STATUS_LABELS[sale.status] ?? sale.status}
                    </td>
                    <td className="px-2 py-3 align-top text-right whitespace-nowrap text-[var(--ink)] print:border-r print:border-black/10 print:px-1.5 print:py-1 print:text-black">
                      {formatCurrency(sale.transport_value)}
                    </td>
                    <td className="px-2 py-3 align-top text-right whitespace-nowrap text-[var(--red-500)] print:border-r print:border-black/10 print:px-1.5 print:py-1 print:text-black">
                      {formatCurrency(sale.total_expenses)}
                    </td>
                    <td className="py-3 pr-3 pl-2 align-top text-right font-bold whitespace-nowrap text-[var(--green-600)] print:px-1.5 print:py-1 print:text-black">
                      {formatCurrency(sale.net_revenue)}
                    </td>
                  </tr>
                  {showExpenses && sale.expenses.length > 0 && (
                    <tr
                      className={`border-b border-[var(--border)] last:border-none ${index % 2 === 1 ? 'bg-[var(--page)]' : ''} print:border-b print:border-black/15 print:bg-white`}
                    >
                      <td className="pb-3 pl-3 print:hidden" />
                      <td colSpan={7} className="pb-3 pr-3 print:p-1">
                        <div className="rounded-xl border border-[var(--border)] bg-[var(--page)] p-3 print:rounded-none print:border print:border-black/15 print:bg-white print:p-1.5">
                          <p className="mb-1.5 text-[10.5px] font-bold tracking-wide text-[var(--muted)] uppercase print:mb-1 print:text-[7.5px] print:text-black">
                            Gastos vinculados ({sale.expenses.length})
                          </p>
                          <table className="w-full text-[12px] print:text-[8px]">
                            <thead>
                              <tr className="text-left text-[10px] font-semibold tracking-wide text-[var(--muted)] uppercase print:text-[7px] print:text-black/50">
                                <th className="py-1 pr-2 font-semibold">Descrição</th>
                                <th className="py-1 pr-2 font-semibold">Categoria</th>
                                <th className="py-1 pr-2 font-semibold">Fornecedor</th>
                                <th className="py-1 pr-2 font-semibold">Vencimento</th>
                                <th className="py-1 text-right font-semibold">Valor</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sale.expenses.map((expense) => (
                                <tr key={expense.id} className="border-t border-[var(--border)] first:border-none print:border-black/10">
                                  <td className="py-1.5 pr-2 text-[var(--ink)] print:py-0.5 print:text-black">
                                    {expense.name || 'Sem descrição'}
                                  </td>
                                  <td className="py-1.5 pr-2 text-[var(--muted)] print:py-0.5 print:text-black/60">
                                    {expense.category_name || '—'}
                                  </td>
                                  <td className="py-1.5 pr-2 text-[var(--muted)] print:py-0.5 print:text-black/60">
                                    {expense.people_name || '—'}
                                  </td>
                                  <td className="py-1.5 pr-2 whitespace-nowrap text-[var(--muted)] print:py-0.5 print:text-black/60">
                                    {formatDate(expense.date_due || expense.date_competence)}
                                  </td>
                                  <td className="py-1.5 text-right font-semibold text-[var(--red-500)] print:py-0.5 print:text-black">
                                    {formatCurrency(expense.amount)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              ))}
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
