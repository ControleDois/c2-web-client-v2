import { useEffect, useState } from 'react'
import {
  fetchGlassBarPlan,
  fetchGlassSheetPlan,
  type GlassBarPlan,
  type GlassSheetPlan,
} from '../../lib/glass'
import { ApiError } from '../../lib/api'
import { formatCurrency } from '../../lib/format'
import { PrintPreviewModal } from '../../components/PrintPreviewModal'
import { CloseIcon, PrinterIcon } from '../../components/icons'
import type { AuthCompany, AuthSession } from '../../lib/auth'

interface GlassOptimizationModalProps {
  open: boolean
  session: AuthSession
  company: AuthCompany
  orderIds?: string[]
  title?: string
  onClose: () => void
}

const pct = (value: number) => `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
const SEGMENT_TONES = ['bg-[var(--blue-500)]', 'bg-[var(--green-600)]', 'bg-[var(--amber-500)]']

export function GlassOptimizationModal({ open, session, company, orderIds, title = 'Plano de corte', onClose }: GlassOptimizationModalProps) {
  const [tab, setTab] = useState<'bars' | 'sheets'>('bars')
  const [barKerf, setBarKerf] = useState('4')
  const [sheetKerf, setSheetKerf] = useState('3')
  const [rotate, setRotate] = useState(true)
  const [barPlans, setBarPlans] = useState<GlassBarPlan[]>([])
  const [sheetPlans, setSheetPlans] = useState<GlassSheetPlan[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [printing, setPrinting] = useState(false)
  const key = (orderIds ?? []).join(',')

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError(null)
    const timeout = setTimeout(() => {
      Promise.all([
        fetchGlassBarPlan(session.token.token, company.id, { orderIds, kerf: Number(barKerf) || 0 }),
        fetchGlassSheetPlan(session.token.token, company.id, { orderIds, kerf: Number(sheetKerf) || 0, rotate }),
      ])
        .then(([bars, sheets]) => {
          if (cancelled) return
          setBarPlans(bars)
          setSheetPlans(sheets)
        })
        .catch((err) => {
          if (!cancelled) setError(err instanceof ApiError ? err.message : 'Não foi possível calcular o plano de corte.')
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, session.token.token, company.id, key, barKerf, sheetKerf, rotate])

  if (!open) return null

  const totalBars = barPlans.reduce((sum, plan) => sum + plan.total_bars, 0)
  const totalSheets = sheetPlans.reduce((sum, plan) => sum + plan.total_sheets, 0)
  const totalBarCost = barPlans.reduce((sum, plan) => sum + plan.estimated_cost, 0)
  const totalSheetCost = sheetPlans.reduce((sum, plan) => sum + plan.estimated_cost, 0)

  const barRows = barPlans.flatMap((plan) =>
    plan.bars.map((bar, index) => ({
      profile: [plan.profile, plan.color].filter(Boolean).join(' · '),
      bar: `Barra ${index + 1} de ${plan.total_bars}`,
      cuts: bar.pieces.map((piece) => piece.length_mm).join(' + '),
      leftover: `${bar.leftover_mm} mm`,
    }))
  )
  const sheetRows = sheetPlans.flatMap((plan) =>
    plan.sheets.map((sheet, index) => ({
      glass: plan.glass_type,
      sheet: `Chapa ${index + 1} de ${plan.total_sheets} (${plan.sheet_width_mm}×${plan.sheet_height_mm})`,
      pieces: sheet.placements.map((p) => `${p.width_mm}×${p.height_mm}${p.rotated ? ' (girada)' : ''}`).join(', '),
      usage: pct(sheet.utilization),
    }))
  )

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[94vh] w-full max-w-[980px] flex-col rounded-2xl bg-[var(--surface)] shadow-[var(--card-shadow)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] p-5">
          <div>
            <h2 className="text-[16px] font-bold text-[var(--ink)]">{title}</h2>
            <p className="mt-0.5 text-[12.5px] text-[var(--ink-soft)]">
              {tab === 'bars'
                ? `${totalBars} barra${totalBars === 1 ? '' : 's'} a comprar · custo estimado ${formatCurrency(totalBarCost)}`
                : `${totalSheets} chapa${totalSheets === 1 ? '' : 's'} de vidro · custo estimado ${formatCurrency(totalSheetCost)}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={tab === 'bars' ? !barRows.length : !sheetRows.length}
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

        <div className="flex flex-wrap items-end gap-3 border-b border-[var(--border)] px-5 pt-3">
          {(['bars', 'sheets'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={`rounded-t-lg px-3.5 py-2 text-[13px] font-bold ${
                tab === value ? 'bg-[var(--page)] text-[var(--ink)]' : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              {value === 'bars' ? 'Barras de perfil' : 'Chapas de vidro'}
            </button>
          ))}
          <div className="ml-auto flex flex-wrap items-center gap-4 pb-2 text-[12.5px] text-[var(--ink-soft)]">
            {tab === 'bars' ? (
              <label className="flex items-center gap-2">
                Espessura da serra (mm)
                <input
                  value={barKerf}
                  inputMode="numeric"
                  onChange={(event) => setBarKerf(event.target.value.replace(/\D/g, ''))}
                  className="w-16 rounded-lg bg-[var(--page)] px-2 py-1 text-[13px] text-[var(--ink)] focus:outline-none"
                />
              </label>
            ) : (
              <>
                <label className="flex items-center gap-2">
                  Espaço entre cortes (mm)
                  <input
                    value={sheetKerf}
                    inputMode="numeric"
                    onChange={(event) => setSheetKerf(event.target.value.replace(/\D/g, ''))}
                    className="w-16 rounded-lg bg-[var(--page)] px-2 py-1 text-[13px] text-[var(--ink)] focus:outline-none"
                  />
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={rotate} onChange={(event) => setRotate(event.target.checked)} className="h-4 w-4 accent-[var(--blue-500)]" />
                  Permitir girar peças
                </label>
              </>
            )}
          </div>
        </div>

        <div className={`overflow-y-auto p-5 ${loading ? 'opacity-60' : ''}`}>
          {error ? (
            <p className="rounded-xl bg-[var(--red-100)] p-4 text-[13px] font-medium text-[var(--red-500)]">{error}</p>
          ) : tab === 'bars' ? (
            barPlans.length === 0 ? (
              <p className="py-8 text-center text-[13.5px] text-[var(--muted)]">Nenhum perfil nas fórmulas dos modelos deste recorte.</p>
            ) : (
              <div className="flex flex-col gap-6">
                {barPlans.map((plan) => (
                  <div key={plan.profile_id}>
                    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="text-[14px] font-bold text-[var(--ink)]">{[plan.profile, plan.color].filter(Boolean).join(' · ')}</h3>
                      <span className="text-[12px] text-[var(--ink-soft)]">
                        {plan.total_bars} barra{plan.total_bars === 1 ? '' : 's'} de {plan.bar_length_mm.toLocaleString('pt-BR')} mm · aproveitamento {pct(plan.utilization)} · {formatCurrency(plan.estimated_cost)}
                      </span>
                    </div>
                    {plan.too_long.length > 0 && (
                      <p className="mb-2 rounded-lg bg-[var(--amber-100)] px-3 py-2 text-[12px] font-medium text-[var(--amber-500)]">
                        {plan.too_long.length} peça(s) maior(es) que a barra ({plan.too_long.map((p) => `${p.length_mm} mm`).join(', ')}) ficaram de fora.
                      </p>
                    )}
                    <div className="flex flex-col gap-1.5">
                      {plan.bars.map((bar, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <span className="w-14 flex-none text-[11.5px] text-[var(--muted)]">Barra {index + 1}</span>
                          <div className="flex h-8 flex-1 overflow-hidden rounded-md bg-[var(--page)]">
                            {bar.pieces.map((piece, pieceIndex) => (
                              <div
                                key={pieceIndex}
                                title={`${piece.length_mm} mm — ${piece.label}`}
                                style={{ width: `${(piece.length_mm / plan.bar_length_mm) * 100}%` }}
                                className={`flex items-center justify-center border-r border-[var(--surface)] text-[10.5px] font-bold text-white ${SEGMENT_TONES[pieceIndex % SEGMENT_TONES.length]}`}
                              >
                                {piece.length_mm}
                              </div>
                            ))}
                          </div>
                          <span className="w-20 flex-none text-right text-[11.5px] text-[var(--ink-soft)]">sobra {bar.leftover_mm}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : sheetPlans.length === 0 ? (
            <p className="py-8 text-center text-[13.5px] text-[var(--muted)]">Nenhuma peça de vidro neste recorte.</p>
          ) : (
            <div className="flex flex-col gap-8">
              {sheetPlans.map((plan) => (
                <div key={plan.glass_type_id ?? 'none'}>
                  <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-[14px] font-bold text-[var(--ink)]">{plan.glass_type}</h3>
                    <span className="text-[12px] text-[var(--ink-soft)]">
                      {plan.total_sheets} chapa{plan.total_sheets === 1 ? '' : 's'} de {plan.sheet_width_mm}×{plan.sheet_height_mm} mm · aproveitamento {pct(plan.utilization)} · {formatCurrency(plan.estimated_cost)}
                    </span>
                  </div>
                  {plan.sheet_assumed && (
                    <p className="mb-2 text-[11.5px] text-[var(--muted)]">Tamanho de chapa padrão; informe o real no cadastro do vidro.</p>
                  )}
                  {plan.too_big.length > 0 && (
                    <p className="mb-2 rounded-lg bg-[var(--amber-100)] px-3 py-2 text-[12px] font-medium text-[var(--amber-500)]">
                      {plan.too_big.length} peça(s) maior(es) que a chapa ({plan.too_big.map((p) => `${p.width_mm}×${p.height_mm}`).join(', ')}) ficaram de fora.
                    </p>
                  )}
                  <div className="flex flex-wrap gap-4">
                    {plan.sheets.map((sheet, index) => (
                      <div key={index} className="w-[260px]">
                        <svg viewBox={`0 0 ${plan.sheet_width_mm} ${plan.sheet_height_mm}`} className="w-full rounded-md border border-[var(--border)] bg-[var(--page)]">
                          {sheet.placements.map((p, pieceIndex) => (
                            <g key={pieceIndex}>
                              <title>{`${p.width_mm}×${p.height_mm}${p.rotated ? ' (girada)' : ''} — ${p.label}`}</title>
                              <rect x={p.x} y={p.y} width={p.width_mm} height={p.height_mm} fill="var(--blue-100)" stroke="var(--blue-500)" strokeWidth={Math.max(plan.sheet_width_mm / 400, 3)} />
                              <text
                                x={p.x + p.width_mm / 2}
                                y={p.y + p.height_mm / 2}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fontSize={Math.max(Math.min(p.width_mm, p.height_mm) / 6, plan.sheet_width_mm / 40)}
                                fill="var(--ink)"
                              >
                                {p.width_mm}×{p.height_mm}
                              </text>
                            </g>
                          ))}
                        </svg>
                        <p className="mt-1 text-[11.5px] text-[var(--ink-soft)]">
                          Chapa {index + 1} · {sheet.placements.length} peça{sheet.placements.length === 1 ? '' : 's'} · {pct(sheet.utilization)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <PrintPreviewModal
        open={printing}
        company={company}
        title={tab === 'bars' ? `${title} — barras` : `${title} — chapas`}
        subtitle={tab === 'bars' ? `${totalBars} barras` : `${totalSheets} chapas`}
        columns={
          tab === 'bars'
            ? [
                { key: 'profile', label: 'Perfil' },
                { key: 'bar', label: 'Barra' },
                { key: 'cuts', label: 'Cortes (mm)' },
                { key: 'leftover', label: 'Sobra', align: 'right' },
              ]
            : [
                { key: 'glass', label: 'Vidro' },
                { key: 'sheet', label: 'Chapa' },
                { key: 'pieces', label: 'Peças (largura × altura)' },
                { key: 'usage', label: 'Aproveit.', align: 'right' },
              ]
        }
        rows={tab === 'bars' ? barRows : sheetRows}
        onClose={() => setPrinting(false)}
      />
    </div>
  )
}
