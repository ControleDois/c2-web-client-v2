import { useEffect, useState } from 'react'
import { fetchGlassCalculationMemory, type GlassCalculationMemory } from '../../lib/glass'
import { ApiError } from '../../lib/api'
import { formatCurrency } from '../../lib/format'
import { PrintPreviewModal } from '../../components/PrintPreviewModal'
import { CloseIcon, PrinterIcon } from '../../components/icons'
import type { AuthCompany, AuthSession } from '../../lib/auth'

interface GlassMemoryModalProps {
  open: boolean
  session: AuthSession
  company: AuthCompany
  order: { id: string; code?: number } | null
  onClose: () => void
}

const number = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
const pct = (value: number) => `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`

const KIND_LABELS: Record<string, string> = {
  glass: 'Vidro',
  profile: 'Perfil',
  accessory: 'Acessório',
  free: 'Ferragem',
  labor: 'Mão de obra',
  frame: 'Esquadria',
}

export function GlassMemoryModal({ open, session, company, order, onClose }: GlassMemoryModalProps) {
  const [memory, setMemory] = useState<GlassCalculationMemory | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [printing, setPrinting] = useState(false)

  useEffect(() => {
    if (!open || !order) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setMemory(null)
    fetchGlassCalculationMemory(session.token.token, order.id)
      .then((res) => {
        if (!cancelled) setMemory(res)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Não foi possível montar a memória de cálculo.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, order, session.token.token])

  if (!open || !order) return null

  const printRows =
    memory?.items.flatMap((item, index) => [
      ...item.lines.map((line) => ({
        item: `${index + 1}. ${item.description} (${item.width_mm}×${item.height_mm} mm) — ${item.quantity} un`,
        line: `${KIND_LABELS[line.kind] ?? line.kind}: ${line.name}`,
        detail: line.detail,
        value: formatCurrency(line.value),
        cost: formatCurrency(line.cost),
      })),
    ]) ?? []

  const totals = memory
    ? [
        { label: 'Total dos itens', value: formatCurrency(memory.totals.items_price) },
        { label: 'Custo estimado dos itens', value: formatCurrency(memory.totals.items_cost) },
        {
          label: `Margem (${pct(memory.totals.margin_percent)})`,
          value: formatCurrency(memory.totals.margin_value),
        },
        { label: 'Total do pedido', value: formatCurrency(memory.totals.final_total), emphasis: true },
      ]
    : undefined

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[94vh] w-full max-w-[920px] flex-col rounded-2xl bg-[var(--surface)] shadow-[var(--card-shadow)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] p-5">
          <div>
            <h2 className="text-[16px] font-bold text-[var(--ink)]">Memória de cálculo — pedido #{order.code}</h2>
            <p className="mt-0.5 text-[12.5px] text-[var(--ink-soft)]">
              {memory
                ? [memory.order.client, memory.order.reference].filter(Boolean).join(' · ') || 'Como o preço de cada item foi formado'
                : 'Como o preço de cada item foi formado'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!printRows.length}
              onClick={() => setPrinting(true)}
              className="flex items-center gap-1.5 rounded-xl bg-[var(--page)] px-3.5 py-2 text-[12.5px] font-bold text-[var(--blue-700)] hover:bg-[var(--blue-100)] disabled:opacity-50"
            >
              <PrinterIcon className="h-3.5 w-3.5" />
              Imprimir
            </button>
            <button type="button" onClick={onClose} aria-label="Fechar" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--page)] hover:text-[var(--ink)]">
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-5">
          {loading ? (
            <div className="h-32 animate-pulse rounded-xl bg-[var(--page)]" />
          ) : error ? (
            <p className="rounded-xl bg-[var(--red-100)] p-4 text-[13px] font-medium text-[var(--red-500)]">{error}</p>
          ) : memory ? (
            <div className="flex flex-col gap-6">
              <div className="grid gap-3 sm:grid-cols-4">
                {[
                  { label: 'Total dos itens', value: formatCurrency(memory.totals.items_price) },
                  { label: 'Custo estimado', value: formatCurrency(memory.totals.items_cost) },
                  { label: `Margem (${pct(memory.totals.margin_percent)})`, value: formatCurrency(memory.totals.margin_value) },
                  { label: 'Total do pedido', value: formatCurrency(memory.totals.final_total) },
                ].map((card) => (
                  <div key={card.label} className="rounded-xl bg-[var(--page)] px-4 py-3">
                    <p className="text-[11.5px] text-[var(--ink-soft)]">{card.label}</p>
                    <p className="text-[16px] font-bold text-[var(--ink)]">{card.value}</p>
                  </div>
                ))}
              </div>
              {(memory.order.markup_percent > 0 || memory.order.discount_value > 0) && (
                <p className="-mt-3 text-[12px] text-[var(--muted)]">
                  O total do pedido considera acréscimo de {pct(memory.order.markup_percent)} e desconto de{' '}
                  {formatCurrency(memory.order.discount_value)}. Ferragens digitadas e mão de obra entram no custo pelo valor
                  cadastrado.
                </p>
              )}

              {memory.items.map((item, index) => (
                <div key={item.id} className="rounded-xl border border-[var(--border)] p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-[14px] font-bold text-[var(--ink)]">
                      {index + 1}. {item.description}
                    </h3>
                    <span className="text-[12px] text-[var(--ink-soft)]">
                      {item.width_mm} × {item.height_mm} mm · {item.quantity} un · {number(item.billed_area_m2)} m²
                    </span>
                  </div>
                  <p className="text-[12px] text-[var(--muted)]">
                    {[item.location, item.model ? `Modelo: ${item.model}` : null, item.glass_type ? `Vidro: ${item.glass_type}` : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  {item.price_overridden && (
                    <p className="mt-2 rounded-lg bg-[var(--amber-100)] px-3 py-1.5 text-[12px] font-medium text-[var(--amber-500)]">
                      Valor alterado manualmente: {formatCurrency(item.saved_unit_price)} por unidade (o cálculo pelo catálogo daria{' '}
                      {formatCurrency(item.calculated_unit_price)}).
                    </p>
                  )}
                  {!item.price_overridden && item.differs && (
                    <p className="mt-2 rounded-lg bg-[var(--amber-100)] px-3 py-1.5 text-[12px] font-medium text-[var(--amber-500)]">
                      O catálogo mudou desde que o item foi salvo: hoje o cálculo dá {formatCurrency(item.calculated_unit_price)} por
                      unidade e o item está com {formatCurrency(item.saved_unit_price)}. Salve o orçamento para recalcular.
                    </p>
                  )}
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full border-collapse text-[13px]">
                      <thead>
                        <tr className="border-b border-[var(--border)] text-left text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                          <th className="pb-1.5">Componente</th>
                          <th className="pb-1.5">Cálculo</th>
                          <th className="pb-1.5 text-right">Venda</th>
                          <th className="pb-1.5 text-right">Custo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {item.lines.map((line, lineIndex) => (
                          <tr key={lineIndex} className="border-b border-[var(--border)] last:border-none">
                            <td className="py-1.5 pr-3">
                              <span className="mr-1.5 text-[11px] font-semibold text-[var(--muted)] uppercase">
                                {KIND_LABELS[line.kind] ?? line.kind}
                              </span>
                              <span className="text-[var(--ink)]">{line.name}</span>
                            </td>
                            <td className="py-1.5 pr-3 text-[var(--ink-soft)]">{line.detail}</td>
                            <td className="py-1.5 text-right">{formatCurrency(line.value)}</td>
                            <td className="py-1.5 text-right text-[var(--ink-soft)]">{formatCurrency(line.cost)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="font-bold text-[var(--ink)]">
                          <td className="pt-2" colSpan={2}>
                            Unitário · × {item.quantity} = total · margem {pct(item.margin_percent)}
                          </td>
                          <td className="pt-2 text-right">
                            {formatCurrency(item.unit_price)}
                            <span className="block text-[11.5px] font-normal text-[var(--ink-soft)]">{formatCurrency(item.total_price)}</span>
                          </td>
                          <td className="pt-2 text-right">
                            {formatCurrency(item.unit_cost)}
                            <span className="block text-[11.5px] font-normal text-[var(--ink-soft)]">{formatCurrency(item.total_cost)}</span>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              ))}

              <div className="rounded-xl border border-[var(--border)] p-4">
                <h3 className="mb-2 text-[14px] font-bold text-[var(--ink)]">Materiais do pedido</h3>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <p className="mb-1 text-[11.5px] font-semibold tracking-wide text-[var(--muted)] uppercase">Vidros</p>
                    {memory.materials.glass.length === 0 ? (
                      <p className="text-[12.5px] text-[var(--muted)]">—</p>
                    ) : (
                      memory.materials.glass.map((row) => (
                        <p key={row.name} className="text-[13px] text-[var(--ink)]">
                          {row.name}: {number(row.area_m2)} m² ({row.pieces} pç)
                        </p>
                      ))
                    )}
                  </div>
                  <div>
                    <p className="mb-1 text-[11.5px] font-semibold tracking-wide text-[var(--muted)] uppercase">Perfis</p>
                    {memory.materials.profiles.length === 0 ? (
                      <p className="text-[12.5px] text-[var(--muted)]">—</p>
                    ) : (
                      memory.materials.profiles.map((row) => (
                        <p key={row.name} className="text-[13px] text-[var(--ink)]">
                          {row.name}: {number(row.meters)} m ({row.pieces} pç)
                        </p>
                      ))
                    )}
                  </div>
                  <div>
                    <p className="mb-1 text-[11.5px] font-semibold tracking-wide text-[var(--muted)] uppercase">Acessórios</p>
                    {memory.materials.accessories.length === 0 ? (
                      <p className="text-[12.5px] text-[var(--muted)]">—</p>
                    ) : (
                      memory.materials.accessories.map((row) => (
                        <p key={row.name} className="text-[13px] text-[var(--ink)]">
                          {row.name}: {number(row.quantity)} {row.unit}
                        </p>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <PrintPreviewModal
        open={printing}
        company={company}
        title={`Memória de cálculo — pedido #${order.code}`}
        subtitle={memory ? [memory.order.client, memory.order.reference].filter(Boolean).join(' · ') : undefined}
        columns={[
          { key: 'item', label: 'Item' },
          { key: 'line', label: 'Componente' },
          { key: 'detail', label: 'Cálculo' },
          { key: 'value', label: 'Venda', align: 'right' },
          { key: 'cost', label: 'Custo', align: 'right' },
        ]}
        rows={printRows}
        totals={totals}
        onClose={() => setPrinting(false)}
      />
    </div>
  )
}
