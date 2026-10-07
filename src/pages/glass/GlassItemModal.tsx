import { useEffect, useState } from 'react'
import {
  previewGlassPrice,
  type GlassModelRecord,
  type GlassOrderItemRecord,
  type GlassPricePreview,
  type GlassTypeRecord,
} from '../../lib/glass'
import { formatCurrency } from '../../lib/format'
import { parseMoney } from '../../lib/money'
import { TextField } from '../../components/form/TextField'
import { MoneyField } from '../../components/form/MoneyField'
import { SelectField } from '../../components/form/SelectField'
import { BoxIcon, TagIcon, FileTextIcon } from '../../components/icons'

interface GlassItemModalProps {
  open: boolean
  token: string
  companyId: string
  item: GlassOrderItemRecord | null
  models: GlassModelRecord[]
  glassTypes: GlassTypeRecord[]
  onSave: (item: GlassOrderItemRecord) => void
  onClose: () => void
}

const digits = (value: string) => value.replace(/\D/g, '')

export function GlassItemModal({ open, token, companyId, item, models, glassTypes, onSave, onClose }: GlassItemModalProps) {
  const [modelId, setModelId] = useState('')
  const [typeId, setTypeId] = useState('')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [width, setWidth] = useState('')
  const [height, setHeight] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [overridden, setOverridden] = useState(false)
  const [manualPrice, setManualPrice] = useState('')
  const [notes, setNotes] = useState('')
  const [preview, setPreview] = useState<GlassPricePreview | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setModelId(item?.glass_model_id ?? '')
    setTypeId(item?.glass_type_id ?? '')
    setLocation(item?.location ?? '')
    setDescription(item?.description ?? '')
    setWidth(item?.width_mm ? String(item.width_mm) : '')
    setHeight(item?.height_mm ? String(item.height_mm) : '')
    setQuantity(item?.quantity ? String(item.quantity) : '1')
    setOverridden(Boolean(item?.price_overridden))
    setManualPrice(item?.price_overridden ? String(item.unit_price) : '')
    setNotes(item?.notes ?? '')
    setPreview(null)
    setError(null)
  }, [open, item])

  const widthMm = Number(width) || 0
  const heightMm = Number(height) || 0
  const qty = Number(quantity) || 0

  useEffect(() => {
    if (!open || widthMm <= 0 || heightMm <= 0 || qty <= 0) {
      setPreview(null)
      return
    }
    let cancelled = false
    setPreviewing(true)
    const timeout = setTimeout(() => {
      previewGlassPrice(token, {
        company_id: companyId,
        glass_model_id: modelId || null,
        glass_type_id: typeId || null,
        width_mm: widthMm,
        height_mm: heightMm,
        quantity: qty,
      })
        .then((res) => {
          if (!cancelled) setPreview(res)
        })
        .catch(() => {
          if (!cancelled) setPreview(null)
        })
        .finally(() => {
          if (!cancelled) setPreviewing(false)
        })
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [open, token, companyId, modelId, typeId, widthMm, heightMm, qty])

  if (!open) return null

  function handleModelChange(nextId: string) {
    setModelId(nextId)
    const model = models.find((entry) => entry.id === nextId)
    if (!model) return
    if (!description.trim()) setDescription(model.name)
    if (!typeId && model.default_glass_type_id) setTypeId(model.default_glass_type_id)
  }

  const unitPrice = overridden ? parseMoney(manualPrice) ?? 0 : preview?.unit_price ?? 0
  const total = Math.round(unitPrice * qty * 100) / 100

  function handleSave() {
    if (!description.trim()) return setError('Informe a descrição do item.')
    if (widthMm <= 0 || heightMm <= 0) return setError('Informe largura e altura em milímetros.')
    if (qty <= 0) return setError('A quantidade precisa ser maior que zero.')
    if (!overridden && !preview) return setError('Aguarde o cálculo do preço.')

    onSave({
      id: item?.id,
      glass_model_id: modelId || null,
      glass_type_id: typeId || null,
      location: location.trim() || null,
      description: description.trim(),
      width_mm: widthMm,
      height_mm: heightMm,
      quantity: qty,
      area_m2: preview?.area_m2,
      unit_price: unitPrice,
      total,
      price_overridden: overridden,
      price_breakdown: preview?.breakdown ?? null,
      notes: notes.trim() || null,
      production_stage: item?.production_stage,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-[720px] overflow-y-auto rounded-2xl bg-[var(--surface)] p-6 shadow-[var(--card-shadow)]"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-[17px] font-bold text-[var(--ink)]">{item ? 'Editar item' : 'Novo item'}</h2>
        <p className="mt-0.5 text-[12px] text-[var(--muted)]">As medidas são em milímetros. O preço é calculado pelo modelo e pelo vidro.</p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <SelectField label="Modelo" variant="surface" value={modelId} onChange={(event) => handleModelChange(event.target.value)}>
            <option value="">Sem modelo (só vidro)</option>
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </SelectField>
          <SelectField label="Vidro" variant="surface" value={typeId} onChange={(event) => setTypeId(event.target.value)}>
            <option value="">Sem vidro</option>
            {glassTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </SelectField>
          <TextField
            label="Descrição"
            icon={<BoxIcon className="h-4 w-4" />}
            placeholder="Ex: Janela de correr 2 folhas"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
          <TextField
            label="Local / ambiente"
            icon={<TagIcon className="h-4 w-4" />}
            placeholder="Ex: Sala, Banheiro suíte"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
          />
          <TextField
            label="Largura (mm)"
            icon={<TagIcon className="h-4 w-4" />}
            inputMode="numeric"
            value={width}
            onChange={(event) => setWidth(digits(event.target.value))}
          />
          <TextField
            label="Altura (mm)"
            icon={<TagIcon className="h-4 w-4" />}
            inputMode="numeric"
            value={height}
            onChange={(event) => setHeight(digits(event.target.value))}
          />
          <TextField
            label="Quantidade"
            icon={<TagIcon className="h-4 w-4" />}
            inputMode="numeric"
            value={quantity}
            onChange={(event) => setQuantity(digits(event.target.value))}
          />
          <TextField
            label="Observação"
            icon={<FileTextIcon className="h-4 w-4" />}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>

        <div className="mt-4 rounded-xl bg-[var(--page)] p-4">
          <label className="flex items-center gap-2.5">
            <input
              type="checkbox"
              checked={overridden}
              onChange={(event) => {
                setOverridden(event.target.checked)
                if (event.target.checked && !manualPrice && preview) setManualPrice(String(preview.unit_price))
              }}
              className="h-4 w-4 accent-[var(--blue-500)]"
            />
            <span className="text-[13px] font-semibold text-[var(--ink)]">Alterar o valor manualmente</span>
          </label>
          {overridden && (
            <div className="mt-3 max-w-[260px]">
              <MoneyField
                label="Valor unitário"
                icon={<TagIcon className="h-4 w-4" />}
                value={manualPrice}
                onChange={(event) => setManualPrice(event.target.value)}
              />
            </div>
          )}

          <div className="mt-3 flex flex-col gap-1 text-[12.5px] text-[var(--ink-soft)]">
            {previewing && !preview && <span>Calculando…</span>}
            {preview && (
              <>
                <span>
                  Área da peça: {preview.area_m2.toLocaleString('pt-BR')} m²
                  {preview.billed_area_m2 !== preview.area_m2 &&
                    ` (cobrada: ${preview.billed_area_m2.toLocaleString('pt-BR')} m²)`}
                </span>
                <span>Vidro: {formatCurrency(preview.breakdown.glass)}</span>
                {preview.breakdown.components.map((component) => (
                  <span key={component.name}>
                    {component.name}: {formatCurrency(component.value)}
                  </span>
                ))}
                <span>Mão de obra: {formatCurrency(preview.breakdown.labor)}</span>
              </>
            )}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-[var(--border)] pt-3 text-[14px]">
            <span className="font-semibold text-[var(--ink-soft)]">
              {formatCurrency(unitPrice)} × {qty || 0}
            </span>
            <span className="text-[16px] font-bold text-[var(--ink)]">{formatCurrency(total)}</span>
          </div>
        </div>

        {error && <p className="mt-3 rounded-xl bg-[var(--red-100)] px-4 py-2.5 text-[13px] font-medium text-[var(--red-500)]">{error}</p>}

        <div className="mt-5 flex items-center justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-xl px-5 py-2.5 text-[14px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]">
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-xl bg-[var(--blue-500)] px-6 py-2.5 text-[14px] font-bold text-white transition hover:bg-[var(--blue-700)]"
          >
            Salvar item
          </button>
        </div>
      </div>
    </div>
  )
}
