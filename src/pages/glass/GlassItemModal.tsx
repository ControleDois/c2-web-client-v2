import { useEffect, useState } from 'react'
import {
  fetchGlassColors,
  previewGlassPrice,
  type GlassColorRecord,
  saveGlassVariableDefaults,
  type GlassModelRecord,
  type GlassVariableValues,
  type GlassOrderItemRecord,
  type GlassPricePreview,
  type GlassTypeRecord,
} from '../../lib/glass'
import { formatCurrency } from '../../lib/format'
import { parseMoney } from '../../lib/money'
import { TextField } from '../../components/form/TextField'
import { MoneyField } from '../../components/form/MoneyField'
import { SelectField } from '../../components/form/SelectField'
import { BoxIcon, TagIcon, FileTextIcon, CalendarIcon } from '../../components/icons'

interface GlassItemModalProps {
  open: boolean
  token: string
  companyId: string
  item: GlassOrderItemRecord | null
  // Item novo já preenchido com os dados de outro (mesma peça, outra medida).
  prefill?: GlassOrderItemRecord | null
  models: GlassModelRecord[]
  glassTypes: GlassTypeRecord[]
  onSave: (item: GlassOrderItemRecord, addAnother?: boolean) => void
  onModelUpdated?: (model: GlassModelRecord) => void
  onClose: () => void
}

const digits = (value: string) => value.replace(/\D/g, '')
// Valor de cada variável do modelo: o que o item já tinha ou o padrão do modelo.
function initialVariableValues(model: GlassModelRecord | undefined, saved?: GlassVariableValues | null) {
  const values: GlassVariableValues = {}
  for (const variable of model?.variables ?? []) {
    const current = saved?.[variable.key]
    if (current !== undefined && current !== null && current !== '') {
      values[variable.key] = current
    } else if (variable.type === 'select') {
      values[variable.key] = variable.default ? String(variable.default) : variable.options?.[0]?.id ?? ''
    } else {
      values[variable.key] = variable.default ?? 0
    }
  }
  return values
}


export function GlassItemModal({ open, token, companyId, item, prefill, models, glassTypes, onSave, onModelUpdated, onClose }: GlassItemModalProps) {
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
  const [itemType, setItemType] = useState('')
  const [aluminumColor, setAluminumColor] = useState('')
  const [accessoryColor, setAccessoryColor] = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [variableValues, setVariableValues] = useState<GlassVariableValues>({})
  const [defaultsNotice, setDefaultsNotice] = useState<string | null>(null)
  const [colors, setColors] = useState<GlassColorRecord[]>([])
  const [supplierFilter, setSupplierFilter] = useState('')
  const [lineFilter, setLineFilter] = useState('')
  const [gaugeFilter, setGaugeFilter] = useState('')
  const [showAllGlass, setShowAllGlass] = useState(false)
  const [preview, setPreview] = useState<GlassPricePreview | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    // "Mesma peça, outra medida": copia tudo menos medidas e valor digitado.
    const source = item ?? prefill ?? null
    setModelId(source?.glass_model_id ?? '')
    setTypeId(source?.glass_type_id ?? '')
    setLocation(source?.location ?? '')
    setDescription(source?.description ?? '')
    setWidth(item?.width_mm ? String(item.width_mm) : '')
    setHeight(item?.height_mm ? String(item.height_mm) : '')
    setQuantity(item?.quantity ? String(item.quantity) : '1')
    setOverridden(Boolean(item?.price_overridden))
    setManualPrice(item?.price_overridden ? String(item.unit_price) : '')
    setNotes(source?.notes ?? '')
    setItemType(source?.item_type ?? '')
    setAluminumColor(source?.aluminum_color ?? '')
    setAccessoryColor(source?.accessory_color ?? '')
    setDeliveryDate(source?.delivery_date ? source.delivery_date.slice(0, 10) : '')
    setVariableValues(
      initialVariableValues(
        models.find((entry) => entry.id === source?.glass_model_id),
        source?.variable_values
      )
    )
    setDefaultsNotice(null)
    setSupplierFilter('')
    setLineFilter('')
    setGaugeFilter('')
    setShowAllGlass(false)
    setPreview(null)
    setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item, prefill])

  useEffect(() => {
    if (!open) return
    fetchGlassColors(token, companyId, { limit: 200, active: true })
      .then((res) => setColors(res.data))
      .catch(() => setColors([]))
  }, [open, token, companyId])

  const widthMm = Number(width) || 0
  const heightMm = Number(height) || 0
  const qty = Number(quantity) || 0
  const selectedModel = models.find((entry) => entry.id === modelId)
  const modelVariables = selectedModel?.variables ?? []
  const hasVariables = modelVariables.length > 0

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
        variable_values: hasVariables ? variableValues : null,
        aluminum_color: aluminumColor.trim() || null,
        accessory_color: accessoryColor.trim() || null,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, token, companyId, modelId, typeId, widthMm, heightMm, qty, variableValues, aluminumColor, accessoryColor])

  // Filtros em cascata do catálogo (fornecedor, linha, bitola) e vidros da bitola do modelo.
  const suppliers = [...new Set(models.map((model) => model.supplier).filter(Boolean))] as string[]
  const lines = [
    ...new Set(
      models.filter((model) => !supplierFilter || model.supplier === supplierFilter).map((model) => model.line).filter(Boolean)
    ),
  ] as string[]
  const gauges = [
    ...new Set(
      models
        .filter((model) => (!supplierFilter || model.supplier === supplierFilter) && (!lineFilter || model.line === lineFilter))
        .map((model) => model.gauge_mm)
        .filter(Boolean)
    ),
  ] as number[]
  const visibleModels = models.filter(
    (model) =>
      model.id === modelId ||
      ((!supplierFilter || model.supplier === supplierFilter) &&
        (!lineFilter || model.line === lineFilter) &&
        (!gaugeFilter || String(model.gauge_mm) === gaugeFilter))
  )
  const gaugeGlass = selectedModel?.gauge_mm
    ? glassTypes.filter((type) => type.thickness_mm === selectedModel.gauge_mm || type.id === typeId)
    : []
  const glassFiltered = Boolean(selectedModel?.gauge_mm) && gaugeGlass.length > 1 && !showAllGlass
  const visibleGlassTypes = glassFiltered ? gaugeGlass : glassTypes

  // Cores cadastradas (com o acréscimo de preço); sem cadastro, campo livre.
  function colorField(kind: 'profile' | 'accessory', label: string, value: string, set: (value: string) => void) {
    const options = colors.filter((color) => color.kind === kind)
    if (!options.length) {
      return (
        <TextField label={label} icon={<TagIcon className="h-4 w-4" />} placeholder="Ex: Preto" value={value} onChange={(event) => set(event.target.value)} />
      )
    }
    const known = options.some((color) => color.name.toLowerCase() === value.trim().toLowerCase())
    return (
      <SelectField label={label} variant="surface" value={value} onChange={(event) => set(event.target.value)}>
        <option value="">Sem cor definida</option>
        {!known && value && <option value={value}>{value} (não cadastrada)</option>}
        {options.map((color) => (
          <option key={color.id} value={color.name}>
            {color.name}
            {color.price_adjust_percent ? ` (${color.price_adjust_percent > 0 ? '+' : ''}${color.price_adjust_percent}%)` : ''}
          </option>
        ))}
      </SelectField>
    )
  }

  if (!open) return null

  function handleModelChange(nextId: string) {
    setModelId(nextId)
    const model = models.find((entry) => entry.id === nextId)
    setVariableValues(initialVariableValues(model))
    setDefaultsNotice(null)
    if (!model) return
    if (!aluminumColor && model.default_aluminum_color) setAluminumColor(model.default_aluminum_color)
    if (!accessoryColor && model.default_accessory_color) setAccessoryColor(model.default_accessory_color)
    if (!description.trim()) setDescription(model.name)
    if (!typeId && model.default_glass_type_id) setTypeId(model.default_glass_type_id)
  }

  async function handleSaveDefaults() {
    if (!selectedModel) return
    try {
      const updated = await saveGlassVariableDefaults(token, selectedModel.id, variableValues)
      onModelUpdated?.(updated)
      setDefaultsNotice('Valores salvos como padrão deste modelo.')
    } catch {
      setDefaultsNotice('Não foi possível salvar o padrão.')
    }
  }

  const unitPrice = overridden ? parseMoney(manualPrice) ?? 0 : preview?.unit_price ?? 0
  const total = Math.round(unitPrice * qty * 100) / 100

  function handleSave(addAnother = false) {
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
      aluminum_color: aluminumColor.trim() || null,
      accessory_color: accessoryColor.trim() || null,
      delivery_date: deliveryDate || null,
      item_type: itemType.trim() || null,
      variable_values: hasVariables ? variableValues : null,
      production_stage: item?.production_stage,
    }, addAnother)
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
          {(suppliers.length > 0 || lines.length > 0 || gauges.length > 0) && (
            <div className="grid gap-4 sm:col-span-2 sm:grid-cols-3">
              {suppliers.length > 0 && (
                <SelectField label="Fornecedor" variant="surface" value={supplierFilter} onChange={(event) => setSupplierFilter(event.target.value)}>
                  <option value="">Todos</option>
                  {suppliers.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </SelectField>
              )}
              {lines.length > 0 && (
                <SelectField label="Linha" variant="surface" value={lineFilter} onChange={(event) => setLineFilter(event.target.value)}>
                  <option value="">Todas</option>
                  {lines.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </SelectField>
              )}
              {gauges.length > 0 && (
                <SelectField label="Bitola" variant="surface" value={gaugeFilter} onChange={(event) => setGaugeFilter(event.target.value)}>
                  <option value="">Todas</option>
                  {gauges.map((value) => (
                    <option key={value} value={String(value)}>
                      {value} mm
                    </option>
                  ))}
                </SelectField>
              )}
            </div>
          )}
          <SelectField label="Modelo" variant="surface" value={modelId} onChange={(event) => handleModelChange(event.target.value)}>
            <option value="">Sem modelo (só vidro)</option>
            {visibleModels.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
                {model.line ? ` — ${model.line}` : ''}
              </option>
            ))}
          </SelectField>
          <div className="flex flex-col gap-1">
            <SelectField label="Vidro" variant="surface" value={typeId} onChange={(event) => setTypeId(event.target.value)}>
              <option value="">Sem vidro</option>
              {visibleGlassTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </SelectField>
            {glassFiltered && (
              <button
                type="button"
                onClick={() => setShowAllGlass(true)}
                className="w-fit text-left text-[11.5px] text-[var(--muted)] hover:text-[var(--ink)]"
              >
                Mostrando vidros de {selectedModel?.gauge_mm} mm (bitola do modelo). Ver todos
              </button>
            )}
          </div>
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
            label="Tipo"
            icon={<TagIcon className="h-4 w-4" />}
            placeholder="Ex: Janela, Porta, Box"
            value={itemType}
            onChange={(event) => setItemType(event.target.value)}
          />
          {colorField('profile', 'Cor do perfil / alumínio', aluminumColor, setAluminumColor)}
          {colorField('accessory', 'Cor dos acessórios', accessoryColor, setAccessoryColor)}
          <TextField
            label="Data de entrega"
            icon={<CalendarIcon className="h-4 w-4" />}
            type="date"
            value={deliveryDate}
            onChange={(event) => setDeliveryDate(event.target.value)}
          />
          <TextField
            label="Observação"
            icon={<FileTextIcon className="h-4 w-4" />}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>

        {hasVariables && (
          <div className="mt-4 rounded-xl bg-[var(--page)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[13px] font-bold text-[var(--ink)]">Variáveis do modelo</p>
              <button
                type="button"
                onClick={handleSaveDefaults}
                className="rounded-lg px-2.5 py-1 text-[12px] font-bold text-[var(--blue-700)] hover:bg-[var(--blue-100)]"
              >
                Salvar como padrão
              </button>
            </div>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {modelVariables.map((variable) => (
                <div key={variable.key} className="flex flex-col gap-1">
                {variable.type === 'select' ? (
                  <SelectField
                    label={variable.label}
                    variant="surface"
                    value={String(variableValues[variable.key] ?? '')}
                    onChange={(event) => setVariableValues((current) => ({ ...current, [variable.key]: event.target.value }))}
                  >
                    {(variable.options ?? []).map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </SelectField>
                ) : (
                  <TextField
                    label={variable.unit ? `${variable.label} (${variable.unit})` : variable.label}
                    icon={<TagIcon className="h-4 w-4" />}
                    inputMode="decimal"
                    value={String(variableValues[variable.key] ?? '')}
                    onChange={(event) =>
                      setVariableValues((current) => ({ ...current, [variable.key]: event.target.value.replace(/[^\d,.-]/g, '') }))
                    }
                  />
                )}
                {variable.help && <span className="text-[11px] text-[var(--muted)]">{variable.help}</span>}
                </div>
              ))}
            </div>
            {defaultsNotice && <p className="mt-2 text-[12px] text-[var(--ink-soft)]">{defaultsNotice}</p>}
          </div>
        )}

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
            onClick={() => handleSave(true)}
            className="rounded-xl bg-[var(--page)] px-5 py-2.5 text-[14px] font-bold text-[var(--blue-700)] transition hover:bg-[var(--blue-100)]"
            title="Salva este item e já abre outro igual, só para informar a nova medida"
          >
            Salvar e incluir mesma peça com outra medida
          </button>
          <button
            type="button"
            onClick={() => handleSave(false)}
            className="rounded-xl bg-[var(--blue-500)] px-6 py-2.5 text-[14px] font-bold text-white transition hover:bg-[var(--blue-700)]"
          >
            Salvar item
          </button>
        </div>
      </div>
    </div>
  )
}
