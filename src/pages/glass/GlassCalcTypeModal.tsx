import { useEffect, useState } from 'react'
import { bulkGlassCalcType, GLASS_CALC_TYPES, type GlassCalcType } from '../../lib/glass'
import { ApiError } from '../../lib/api'
import { parseMoney } from '../../lib/money'
import { MoneyField } from '../../components/form/MoneyField'
import { SelectField } from '../../components/form/SelectField'
import { TextField } from '../../components/form/TextField'
import { CloseIcon, CoinIcon, TagIcon } from '../../components/icons'
import type { AuthCompany, AuthSession } from '../../lib/auth'

interface GlassCalcTypeModalProps {
  open: boolean
  session: AuthSession
  company: AuthCompany
  // Filtros atuais da lista de modelos: a troca vale para os modelos que eles mostram.
  scope: { supplier: string; line: string; gauge: string }
  onClose: () => void
  onApplied: (updated: number) => void
}

// "Trocar tipo de cálculo": muda o tipo (composição, custo + margem, preço por m²) de vários modelos de uma vez.
export function GlassCalcTypeModal({ open, session, company, scope, onClose, onApplied }: GlassCalcTypeModalProps) {
  const [calcType, setCalcType] = useState<GlassCalcType>('cost_margin')
  const [margin, setMargin] = useState('')
  const [framePrice, setFramePrice] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setCalcType('cost_margin')
    setMargin('')
    setFramePrice('')
    setError(null)
  }, [open])

  if (!open) return null

  const scopeText =
    [scope.supplier, scope.line, scope.gauge ? `${scope.gauge} mm` : ''].filter(Boolean).join(' · ') || 'todos os modelos'

  async function handleApply() {
    setError(null)
    const marginValue = Number(margin.replace(',', '.'))
    const priceValue = parseMoney(framePrice)
    if (calcType === 'cost_margin' && (!margin.trim() || !(marginValue >= 0))) return setError('Informe a margem sobre o custo.')
    if (calcType === 'per_m2' && !(priceValue && priceValue > 0)) return setError('Informe o preço por m² da esquadria.')
    setBusy(true)
    try {
      const result = await bulkGlassCalcType(session.token.token, {
        company_id: company.id,
        calc_type: calcType,
        margin_percent: calcType === 'cost_margin' ? marginValue : undefined,
        frame_price_per_m2: calcType === 'per_m2' ? priceValue ?? 0 : undefined,
        supplier: scope.supplier || undefined,
        line: scope.line || undefined,
        gauge: scope.gauge ? Number(scope.gauge) : undefined,
      })
      onApplied(result.updated)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível trocar o tipo de cálculo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-[560px] overflow-y-auto rounded-2xl bg-[var(--surface)] p-6 shadow-[var(--card-shadow)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[17px] font-bold text-[var(--ink)]">Trocar tipo de cálculo</h2>
            <p className="mt-0.5 text-[12px] text-[var(--muted)]">
              Vale para: <b className="text-[var(--ink-soft)]">{scopeText}</b>. Mude os filtros da lista para escolher outro grupo.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--page)] hover:text-[var(--ink)]"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-4">
          <SelectField label="Novo tipo de cálculo" variant="surface" value={calcType} onChange={(event) => setCalcType(event.target.value as GlassCalcType)}>
            {GLASS_CALC_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </SelectField>
          {calcType === 'cost_margin' && (
            <TextField
              label="Margem sobre o custo (%)"
              icon={<TagIcon className="h-4 w-4" />}
              inputMode="decimal"
              placeholder="Ex: 60"
              value={margin}
              onChange={(event) => setMargin(event.target.value.replace(/[^\d,.]/g, ''))}
            />
          )}
          {calcType === 'per_m2' && (
            <MoneyField label="Preço por m² da esquadria" icon={<CoinIcon className="h-4 w-4" />} value={framePrice} onChange={(event) => setFramePrice(event.target.value)} />
          )}
          <p className="rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[12px] text-[var(--ink-soft)]">
            {GLASS_CALC_TYPES.find((type) => type.value === calcType)?.hint} Os pedidos já salvos não mudam: o novo cálculo vale quando o item é calculado
            ou salvo de novo.
          </p>
        </div>

        {error && <p className="mt-3 rounded-xl bg-[var(--red-100)] px-4 py-2.5 text-[13px] font-medium text-[var(--red-500)]">{error}</p>}

        <div className="mt-5 flex items-center justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-xl px-5 py-2.5 text-[14px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]">
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={busy}
            className="rounded-xl bg-[var(--blue-500)] px-6 py-2.5 text-[14px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:opacity-60"
          >
            {busy ? 'Aplicando…' : 'Aplicar aos modelos'}
          </button>
        </div>
      </div>
    </div>
  )
}
