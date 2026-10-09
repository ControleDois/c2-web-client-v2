import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { formatCurrency } from '../../lib/format'
import {
  createGlassModel,
  fetchGlassModel,
  fetchGlassAccessories,
  fetchGlassColors,
  fetchGlassModelFilters,
  fetchGlassProfiles,
  fetchGlassTypes,
  simulateGlassModel,
  uploadGlassModelImage,
  removeGlassModelImage,
  updateGlassModel,
  GLASS_CATEGORIES,
  GLASS_CALC_TYPES,
  GLASS_COMPONENT_MODES,
  type GlassAccessoryRecord,
  type GlassComponent,
  type GlassCalcType,
  type GlassColorRecord,
  type GlassComponentKind,
  type GlassModelFilters,
  type GlassModelRecord,
  type GlassProfileRecord,
  type GlassSimulationRow,
  type GlassTypeRecord,
  type GlassVariable,
} from '../../lib/glass'
import { parseMoney } from '../../lib/money'
import { ApiError } from '../../lib/api'
import { TextField } from '../../components/form/TextField'
import { MoneyField } from '../../components/form/MoneyField'
import { SelectField } from '../../components/form/SelectField'
import { FiscalProductField } from '../../components/form/FiscalProductField'
import { SectionCard } from '../../components/SectionCard'
import { TagIcon, CoinIcon, ChevronLeftIcon, BoxIcon, PlusIcon, TrashIcon } from '../../components/icons'
import type { AuthSession, AuthCompany } from '../../lib/auth'

interface GlassModelFormPageProps {
  session: AuthSession
  company: AuthCompany
  glassModelId?: string
  onBack: () => void
  onSaved: () => void
}

interface ComponentRow {
  key: string
  kind: GlassComponentKind
  name: string
  mode: NonNullable<GlassComponent['mode']>
  quantity: string
  unitValue: string
  profileId: string
  accessoryId: string
  lengthFormula: string
  quantityFormula: string
  profileVariable: string
  accessoryVariable: string
  condition: string
}

interface OptionRow {
  id: string
  label: string
  value: string
  profileId: string
  accessoryId: string
}

interface VariableRow {
  rowKey: string
  key: string
  label: string
  type: 'select' | 'number'
  unit: string
  help: string
  defaultText: string
  options: OptionRow[]
}

let variableCounter = 0
const newOption = (partial: Partial<OptionRow> = {}): OptionRow => ({
  id: `o${Date.now().toString(36)}${++variableCounter}`,
  label: '',
  value: '0',
  profileId: '',
  accessoryId: '',
  ...partial,
})
const newVariable = (partial: Partial<VariableRow> = {}): VariableRow => ({
  rowKey: `var-${++variableCounter}`,
  key: '',
  label: '',
  type: 'select',
  unit: '',
  help: '',
  defaultText: '',
  options: [],
  ...partial,
})

function toVariable(row: VariableRow): GlassVariable | null {
  const key = row.key.trim().toUpperCase()
  const label = row.label.trim()
  if (!key || !label) return null
  if (row.type === 'number') {
    return {
      key,
      label,
      type: 'number',
      unit: row.unit.trim() || null,
      help: row.help.trim() || null,
      default: row.defaultText.trim() || '0',
    }
  }
  const options = row.options
    .filter((option) => option.label.trim())
    .map((option) => ({
      id: option.id,
      label: option.label.trim(),
      value: Number(option.value.replace(',', '.')) || 0,
      profile_id: option.profileId || null,
      accessory_id: option.accessoryId || null,
    }))
  if (!options.length) return null
  return { key, label, type: 'select', help: row.help.trim() || null, options, default: row.defaultText || options[0].id }
}

const KIND_LABELS: Record<GlassComponentKind, string> = {
  free: 'Ferragem (valor fixo)',
  profile: 'Perfil (fórmula)',
  accessory: 'Acessório (fórmula)',
}

function toComponent(row: ComponentRow): GlassComponent | null {
  const condition = row.condition.trim() || null
  if (row.kind === 'profile') {
    if (!row.profileId && !row.profileVariable) return null
    return {
      kind: 'profile',
      name: row.name.trim() || 'Perfil',
      profile_id: row.profileId || null,
      profile_variable: row.profileVariable || null,
      length_formula: row.lengthFormula.trim(),
      quantity_formula: row.quantityFormula.trim() || '1',
      condition,
    }
  }
  if (row.kind === 'accessory') {
    if (!row.accessoryId && !row.accessoryVariable) return null
    return {
      kind: 'accessory',
      name: row.name.trim() || 'Acessório',
      accessory_id: row.accessoryId || null,
      accessory_variable: row.accessoryVariable || null,
      quantity_formula: row.quantityFormula.trim() || '1',
      condition,
    }
  }
  if (!row.name.trim()) return null
  return {
    kind: 'free',
    name: row.name.trim(),
    mode: row.mode,
    quantity: Number(row.quantity.replace(',', '.')) || 0,
    unit_value: parseMoney(row.unitValue) ?? 0,
    condition,
  }
}

let rowCounter = 0
const newRow = (partial: Partial<ComponentRow> = {}): ComponentRow => ({
  key: `row-${++rowCounter}`,
  kind: 'free',
  name: '',
  mode: 'fixed',
  quantity: '1',
  unitValue: '',
  profileId: '',
  accessoryId: '',
  lengthFormula: '',
  profileVariable: '',
  accessoryVariable: '',
  condition: '',
  quantityFormula: '',
  ...partial,
})

export function GlassModelFormPage({ session, company, glassModelId, onBack, onSaved }: GlassModelFormPageProps) {
  const [loading, setLoading] = useState(Boolean(glassModelId))
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [glassTypes, setGlassTypes] = useState<GlassTypeRecord[]>([])
  const [name, setName] = useState('')
  const [category, setCategory] = useState('Janela')
  const [folhas, setFolhas] = useState('1')
  const [line, setLine] = useState('')
  const [supplier, setSupplier] = useState('')
  const [gauge, setGauge] = useState('')
  const [defaultAluminumColor, setDefaultAluminumColor] = useState('')
  const [defaultAccessoryColor, setDefaultAccessoryColor] = useState('')
  const [colors, setColors] = useState<GlassColorRecord[]>([])
  const [catalogFilters, setCatalogFilters] = useState<GlassModelFilters>({ suppliers: [], lines: [], gauges: [] })
  const [defaultGlassTypeId, setDefaultGlassTypeId] = useState('')
  const [laborPerM2, setLaborPerM2] = useState('')
  const [laborFixed, setLaborFixed] = useState('')
  const [calcType, setCalcType] = useState<GlassCalcType>('composition')
  const [marginPercent, setMarginPercent] = useState('')
  const [framePrice, setFramePrice] = useState('')
  const [cutWidthDiscount, setCutWidthDiscount] = useState('')
  const [cutHeightDiscount, setCutHeightDiscount] = useState('')
  const [active, setActive] = useState(true)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [product, setProduct] = useState<{ id: string; name: string } | null>(null)
  const [rows, setRows] = useState<ComponentRow[]>([])
  const [varRows, setVarRows] = useState<VariableRow[]>([])
  const [profiles, setProfiles] = useState<GlassProfileRecord[]>([])
  const [accessories, setAccessories] = useState<GlassAccessoryRecord[]>([])
  const [sampleWidth, setSampleWidth] = useState('1500')
  const [sampleHeight, setSampleHeight] = useState('1000')
  const [simulation, setSimulation] = useState<{ rows: GlassSimulationRow[]; total: number } | null>(null)
  const [simulationError, setSimulationError] = useState<string | null>(null)

  useEffect(() => {
    fetchGlassModelFilters(session.token.token, company.id)
      .then(setCatalogFilters)
      .catch(() => setCatalogFilters({ suppliers: [], lines: [], gauges: [] }))
    fetchGlassColors(session.token.token, company.id, { limit: 200, active: true })
      .then((res) => setColors(res.data))
      .catch(() => setColors([]))
  }, [session.token.token, company.id])

  useEffect(() => {
    fetchGlassTypes(session.token.token, company.id, { limit: 200, active: true })
      .then((res) => setGlassTypes(res.data || []))
      .catch(() => setGlassTypes([]))
    fetchGlassProfiles(session.token.token, company.id, { limit: 200, active: true })
      .then((res) => setProfiles(res.data || []))
      .catch(() => setProfiles([]))
    fetchGlassAccessories(session.token.token, company.id, { limit: 200, active: true })
      .then((res) => setAccessories(res.data || []))
      .catch(() => setAccessories([]))
  }, [session.token.token, company.id])

  useEffect(() => {
    if (!glassModelId) return
    let cancelled = false
    fetchGlassModel(session.token.token, glassModelId)
      .then((item: GlassModelRecord) => {
        if (cancelled) return
        setName(item.name)
        setCategory(item.category)
        setFolhas(String(item.folhas ?? 1))
        setLine(item.line ?? '')
        setSupplier(item.supplier ?? '')
        setGauge(item.gauge_mm ? String(item.gauge_mm) : '')
        setDefaultAluminumColor(item.default_aluminum_color ?? '')
        setDefaultAccessoryColor(item.default_accessory_color ?? '')
        setDefaultGlassTypeId(item.default_glass_type_id ?? '')
        setLaborPerM2(String(item.labor_per_m2 ?? ''))
        setLaborFixed(String(item.labor_fixed ?? ''))
        setCalcType(item.calc_type ?? 'composition')
        setMarginPercent(item.margin_percent ? String(item.margin_percent).replace('.', ',') : '')
        setFramePrice(item.frame_price_per_m2 ? String(item.frame_price_per_m2) : '')
        setCutWidthDiscount(item.cut_width_discount_mm ? String(item.cut_width_discount_mm) : '')
        setCutHeightDiscount(item.cut_height_discount_mm ? String(item.cut_height_discount_mm) : '')
        setActive(item.active)
        setImageUrl(item.image_url ?? null)
        setProduct(item.product ? { id: item.product.id, name: item.product.name } : null)
        setRows(
          (item.components ?? []).map((component) =>
            newRow({
              kind: component.kind ?? 'free',
              name: component.name,
              mode: component.mode ?? 'fixed',
              quantity: String(component.quantity ?? 1).replace('.', ','),
              unitValue: String(component.unit_value ?? ''),
              profileId: component.profile_id ?? '',
              accessoryId: component.accessory_id ?? '',
              lengthFormula: component.length_formula ?? '',
              quantityFormula: component.quantity_formula ?? '',
              profileVariable: component.profile_variable ?? '',
              accessoryVariable: component.accessory_variable ?? '',
              condition: component.condition ?? '',
            })
          )
        )
        setVarRows(
          (item.variables ?? []).map((variable) =>
            newVariable({
              key: variable.key,
              label: variable.label,
              type: variable.type,
              unit: variable.unit ?? '',
              help: variable.help ?? '',
              defaultText: variable.default === null || variable.default === undefined ? '' : String(variable.default),
              options: (variable.options ?? []).map((option) =>
                newOption({
                  id: option.id,
                  label: option.label,
                  value: String(option.value ?? 0),
                  profileId: option.profile_id ?? '',
                  accessoryId: option.accessory_id ?? '',
                })
              ),
            })
          )
        )
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof ApiError ? err.message : 'Não foi possível carregar o modelo.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [glassModelId, session.token.token])

  function updateRow(key: string, patch: Partial<ComponentRow>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  const simulationComponents = useMemo(
    () => rows.map(toComponent).filter((component): component is GlassComponent => component !== null),
    [rows]
  )

  const simulationVariables = useMemo(
    () => varRows.map(toVariable).filter((variable): variable is GlassVariable => variable !== null),
    [varRows]
  )

  function updateVariable(rowKey: string, patch: Partial<VariableRow>) {
    setVarRows((current) => current.map((row) => (row.rowKey === rowKey ? { ...row, ...patch } : row)))
  }

  function updateOption(rowKey: string, optionId: string, patch: Partial<OptionRow>) {
    setVarRows((current) =>
      current.map((row) =>
        row.rowKey === rowKey
          ? { ...row, options: row.options.map((option) => (option.id === optionId ? { ...option, ...patch } : option)) }
          : row
      )
    )
  }

  useEffect(() => {
    const width = Number(sampleWidth)
    const height = Number(sampleHeight)
    if (!simulationComponents.length || width <= 0 || height <= 0) {
      setSimulation(null)
      setSimulationError(null)
      return
    }
    let cancelled = false
    const timeout = setTimeout(() => {
      simulateGlassModel(session.token.token, {
        company_id: company.id,
        width_mm: width,
        height_mm: height,
        folhas: Math.max(Number(folhas) || 1, 1),
        components: simulationComponents,
        variables: simulationVariables,
      })
        .then((res) => {
          if (cancelled) return
          setSimulation(res)
          setSimulationError(null)
        })
        .catch((err) => {
          if (cancelled) return
          setSimulation(null)
          setSimulationError(err instanceof ApiError ? err.message : 'Não foi possível simular.')
        })
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [session.token.token, company.id, simulationComponents, simulationVariables, sampleWidth, sampleHeight, folhas])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError('Preencha o nome para continuar.')
      return
    }
    const components = rows.map(toComponent).filter((component): component is GlassComponent => component !== null)

    const payload = {
      company_id: company.id,
      name: name.trim(),
      category,
      folhas: Math.max(Number(folhas) || 1, 1),
      line: line.trim() || null,
      supplier: supplier.trim() || null,
      gauge_mm: Number(gauge) || null,
      default_aluminum_color: defaultAluminumColor || null,
      default_accessory_color: defaultAccessoryColor || null,
      default_glass_type_id: defaultGlassTypeId || null,
      labor_per_m2: parseMoney(laborPerM2) ?? 0,
      labor_fixed: parseMoney(laborFixed) ?? 0,
      calc_type: calcType,
      margin_percent: Number(marginPercent.replace(',', '.')) || 0,
      frame_price_per_m2: parseMoney(framePrice) ?? 0,
      cut_width_discount_mm: Number(cutWidthDiscount) || 0,
      product_id: product?.id ?? null,
      cut_height_discount_mm: Number(cutHeightDiscount) || 0,
      active,
      components,
      variables: simulationVariables,
    }

    setSubmitting(true)
    try {
      const saved = glassModelId
        ? await updateGlassModel(session.token.token, glassModelId, payload)
        : await createGlassModel(session.token.token, payload)
      if (imageFile) await uploadGlassModelImage(session.token.token, saved.id, imageFile)
      else if (glassModelId && !imageUrl) await removeGlassModelImage(session.token.token, glassModelId)
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar o modelo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div>
        <button
          type="button"
          onClick={onBack}
          className="mb-3 flex items-center gap-1 text-[12.5px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]"
        >
          <ChevronLeftIcon className="h-3.5 w-3.5" />
          Voltar para modelos
        </button>
        <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Vidraçaria</p>
        <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">
          {glassModelId ? 'Editar modelo' : 'Novo modelo'}
        </h1>
      </div>

      {loading ? (
        <div className="h-11 animate-pulse rounded-xl bg-[var(--surface)]" />
      ) : loadError ? (
        <p className="rounded-2xl bg-[var(--red-100)] p-5 text-[13.5px] font-medium text-[var(--red-500)]">{loadError}</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <datalist id="glass-suppliers">
            {catalogFilters.suppliers.map((value) => (
              <option key={value} value={value} />
            ))}
          </datalist>
          <datalist id="glass-lines">
            {catalogFilters.lines.map((value) => (
              <option key={value} value={value} />
            ))}
          </datalist>
          <SectionCard
            title="Dados do modelo"
            subtitle="O modelo define o vidro padrão, a mão de obra e as ferragens que entram no preço do item"
          >
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <TextField
                label="Nome"
                icon={<BoxIcon className="h-4 w-4" />}
                placeholder="Ex: Janela de correr 2 folhas"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              <SelectField label="Categoria" value={category} onChange={(event) => setCategory(event.target.value)}>
                {GLASS_CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </SelectField>
              <TextField
                label="Folhas"
                icon={<TagIcon className="h-4 w-4" />}
                inputMode="numeric"
                value={folhas}
                onChange={(event) => setFolhas(event.target.value.replace(/\D/g, ''))}
              />
              <TextField
                label="Fornecedor do sistema"
                icon={<TagIcon className="h-4 w-4" />}
                list="glass-suppliers"
                placeholder="Ex: Perfisud, Vitralsul"
                value={supplier}
                onChange={(event) => setSupplier(event.target.value)}
              />
              <TextField
                label="Linha"
                icon={<TagIcon className="h-4 w-4" />}
                list="glass-lines"
                placeholder="Ex: Suprema, Gold, Solene 32"
                value={line}
                onChange={(event) => setLine(event.target.value)}
              />
              <TextField
                label="Bitola do vidro (mm)"
                icon={<TagIcon className="h-4 w-4" />}
                inputMode="numeric"
                placeholder="Ex: 6, 8, 10"
                value={gauge}
                onChange={(event) => setGauge(event.target.value.replace(/\D/g, ''))}
              />
              <SelectField label="Cor padrão do perfil" value={defaultAluminumColor} onChange={(event) => setDefaultAluminumColor(event.target.value)}>
                <option value="">Sem cor padrão</option>
                {colors
                  .filter((color) => color.kind === 'profile')
                  .map((color) => (
                    <option key={color.id} value={color.name}>
                      {color.name}
                    </option>
                  ))}
              </SelectField>
              <SelectField label="Cor padrão dos acessórios" value={defaultAccessoryColor} onChange={(event) => setDefaultAccessoryColor(event.target.value)}>
                <option value="">Sem cor padrão</option>
                {colors
                  .filter((color) => color.kind === 'accessory')
                  .map((color) => (
                    <option key={color.id} value={color.name}>
                      {color.name}
                    </option>
                  ))}
              </SelectField>
              <SelectField
                label="Vidro padrão"
                value={defaultGlassTypeId}
                onChange={(event) => setDefaultGlassTypeId(event.target.value)}
              >
                <option value="">Sem vidro padrão</option>
                {glassTypes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </SelectField>
              <SelectField label="Tipo de cálculo" value={calcType} onChange={(event) => setCalcType(event.target.value as GlassCalcType)}>
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
                  value={marginPercent}
                  onChange={(event) => setMarginPercent(event.target.value.replace(/[^\d,.]/g, ''))}
                />
              )}
              {calcType === 'per_m2' && (
                <MoneyField
                  label="Preço por m² da esquadria"
                  icon={<CoinIcon className="h-4 w-4" />}
                  value={framePrice}
                  onChange={(event) => setFramePrice(event.target.value)}
                />
              )}
              <MoneyField
                label="Mão de obra por m²"
                icon={<CoinIcon className="h-4 w-4" />}
                value={laborPerM2}
                onChange={(event) => setLaborPerM2(event.target.value)}
              />
              <MoneyField
                label="Mão de obra fixa por peça"
                icon={<CoinIcon className="h-4 w-4" />}
                value={laborFixed}
                onChange={(event) => setLaborFixed(event.target.value)}
              />
              <FiscalProductField session={session} company={company} value={product} onChange={setProduct} />
              <TextField
                label="Desconto na largura do vidro (mm)"
                icon={<TagIcon className="h-4 w-4" />}
                inputMode="numeric"
                placeholder="Ex: 20"
                value={cutWidthDiscount}
                onChange={(event) => setCutWidthDiscount(event.target.value.replace(/\D/g, ''))}
              />
              <TextField
                label="Desconto na altura do vidro (mm)"
                icon={<TagIcon className="h-4 w-4" />}
                inputMode="numeric"
                placeholder="Ex: 10"
                value={cutHeightDiscount}
                onChange={(event) => setCutHeightDiscount(event.target.value.replace(/\D/g, ''))}
              />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-4 rounded-xl bg-[var(--page)] p-4">
              <span className="flex h-20 w-28 flex-none items-center justify-center overflow-hidden rounded-lg border border-[var(--border)] bg-white">
                {imageFile || imageUrl ? (
                  <img
                    src={imageFile ? URL.createObjectURL(imageFile) : (imageUrl as string)}
                    alt="Desenho do modelo"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <span className="px-2 text-center text-[11px] text-[var(--muted)]">Desenho padrão pelas folhas</span>
                )}
              </span>
              <div className="flex flex-col gap-1.5">
                <label className="flex w-fit cursor-pointer items-center gap-2 rounded-xl border border-[var(--border)] px-3.5 py-2 text-[12.5px] font-bold text-[var(--ink-soft)] hover:text-[var(--ink)]">
                  {imageFile ? imageFile.name : 'Enviar desenho do modelo'}
                  <input
                    type="file"
                    accept=".png,.jpg,.jpeg,.webp"
                    className="hidden"
                    onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
                  />
                </label>
                {(imageFile || imageUrl) && (
                  <button
                    type="button"
                    onClick={() => {
                      setImageFile(null)
                      setImageUrl(null)
                    }}
                    className="w-fit text-[11.5px] font-bold text-[var(--red-500)] hover:underline"
                  >
                    Remover desenho
                  </button>
                )}
                <p className="text-[11.5px] text-[var(--muted)]">
                  Aparece em cada item e no orçamento impresso. Sem imagem, o orçamento usa um desenho simples com as folhas.
                </p>
              </div>
            </div>
            <p className="mt-2 text-[11.5px] text-[var(--muted)]">
              {GLASS_CALC_TYPES.find((type) => type.value === calcType)?.hint}
            </p>
            <p className="mt-2 text-[11.5px] text-[var(--muted)]">
              Na lista de corte, a peça de vidro é a medida do vão menos esses descontos; a largura ainda é dividida pelo
              número de folhas.
            </p>
            <label className="mt-4 flex items-center gap-2.5">
              <input
                type="checkbox"
                checked={active}
                onChange={(event) => setActive(event.target.checked)}
                className="h-4 w-4 accent-[var(--blue-500)]"
              />
              <span className="text-[13.5px] font-semibold text-[var(--ink)]">Ativo (aparece nos orçamentos)</span>
            </label>
          </SectionCard>

          <SectionCard
            title="Variáveis do modelo"
            subtitle="Perguntas feitas em cada item (modo de fechamento, tipo de roldana, folga…). As respostas entram nas fórmulas e escolhem perfis e acessórios"
            defaultCollapsed={varRows.length === 0}
          >
            <div className="flex flex-col gap-3">
              <p className="rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[12px] text-[var(--ink-soft)]">
                Cada variável tem uma <b>chave</b> (letras maiúsculas, ex.: <b>T</b> ou <b>FOLGA_L</b>) que você usa nas fórmulas das
                linhas abaixo. <b>Lista</b>: cada opção tem um número para as fórmulas (ex.: Sim = 1, Não = 0) e pode escolher um perfil ou
                acessório. <b>Número</b>: o operador digita o valor no item (ex.: folga em mm).
              </p>
              {varRows.length === 0 && <p className="text-[13px] text-[var(--muted)]">Nenhuma variável. Este modelo usa só a largura e a altura.</p>}
              {varRows.map((row) => (
                <div key={row.rowKey} className="flex flex-col gap-3 rounded-xl bg-[var(--page)] p-3">
                  <div className="grid items-end gap-3 sm:grid-cols-[110px_2fr_1.2fr_1fr_auto]">
                    <TextField
                      label="Chave"
                      icon={<TagIcon className="h-4 w-4" />}
                      placeholder="Ex: T"
                      value={row.key}
                      onChange={(event) =>
                        updateVariable(row.rowKey, { key: event.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 20) })
                      }
                    />
                    <TextField
                      label="Pergunta"
                      icon={<BoxIcon className="h-4 w-4" />}
                      placeholder="Ex: Modo de fechamento"
                      value={row.label}
                      onChange={(event) => updateVariable(row.rowKey, { label: event.target.value })}
                    />
                    <SelectField
                      label="Tipo"
                      variant="surface"
                      value={row.type}
                      onChange={(event) => updateVariable(row.rowKey, { type: event.target.value as VariableRow['type'], defaultText: '' })}
                    >
                      <option value="select">Lista de opções</option>
                      <option value="number">Número</option>
                    </SelectField>
                    {row.type === 'number' ? (
                      <div className="grid grid-cols-2 gap-2">
                        <TextField
                          label="Padrão"
                          icon={<TagIcon className="h-4 w-4" />}
                          inputMode="decimal"
                          value={row.defaultText}
                          onChange={(event) => updateVariable(row.rowKey, { defaultText: event.target.value.replace(/[^\d,.-]/g, '') })}
                        />
                        <TextField
                          label="Unidade"
                          icon={<TagIcon className="h-4 w-4" />}
                          placeholder="mm"
                          value={row.unit}
                          onChange={(event) => updateVariable(row.rowKey, { unit: event.target.value })}
                        />
                      </div>
                    ) : (
                      <SelectField
                        label="Opção padrão"
                        variant="surface"
                        value={row.defaultText}
                        onChange={(event) => updateVariable(row.rowKey, { defaultText: event.target.value })}
                      >
                        <option value="">Primeira da lista</option>
                        {row.options
                          .filter((option) => option.label.trim())
                          .map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                      </SelectField>
                    )}
                    <button
                      type="button"
                      onClick={() => setVarRows((current) => current.filter((item) => item.rowKey !== row.rowKey))}
                      className="mb-1 flex h-9 w-9 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--red-100)] hover:text-[var(--red-500)]"
                      aria-label="Remover variável"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>

                  {row.type === 'select' && (
                    <div className="flex flex-col gap-2 border-l-2 border-[var(--border)] pl-3">
                      {row.options.map((option) => (
                        <div key={option.id} className="grid items-end gap-2 sm:grid-cols-[2fr_90px_1.5fr_1.5fr_auto]">
                          <TextField
                            label="Opção"
                            icon={<TagIcon className="h-4 w-4" />}
                            placeholder="Ex: Bate-fecha"
                            value={option.label}
                            onChange={(event) => updateOption(row.rowKey, option.id, { label: event.target.value })}
                          />
                          <TextField
                            label="Número"
                            icon={<TagIcon className="h-4 w-4" />}
                            inputMode="decimal"
                            value={option.value}
                            onChange={(event) => updateOption(row.rowKey, option.id, { value: event.target.value.replace(/[^\d,.-]/g, '') })}
                          />
                          <SelectField
                            label="Perfil"
                            variant="surface"
                            value={option.profileId}
                            onChange={(event) => updateOption(row.rowKey, option.id, { profileId: event.target.value })}
                          >
                            <option value="">—</option>
                            {profiles.map((profile) => (
                              <option key={profile.id} value={profile.id}>
                                {[profile.name, profile.color].filter(Boolean).join(' · ')}
                              </option>
                            ))}
                          </SelectField>
                          <SelectField
                            label="Acessório"
                            variant="surface"
                            value={option.accessoryId}
                            onChange={(event) => updateOption(row.rowKey, option.id, { accessoryId: event.target.value })}
                          >
                            <option value="">—</option>
                            {accessories.map((accessory) => (
                              <option key={accessory.id} value={accessory.id}>
                                {accessory.name}
                              </option>
                            ))}
                          </SelectField>
                          <button
                            type="button"
                            onClick={() =>
                              updateVariable(row.rowKey, { options: row.options.filter((item) => item.id !== option.id) })
                            }
                            className="mb-1 flex h-9 w-9 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--red-100)] hover:text-[var(--red-500)]"
                            aria-label="Remover opção"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => updateVariable(row.rowKey, { options: [...row.options, newOption()] })}
                        className="flex w-fit items-center gap-1.5 rounded-xl border border-[var(--border)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink-soft)] hover:text-[var(--ink)]"
                      >
                        <PlusIcon className="h-3.5 w-3.5" /> Opção
                      </button>
                    </div>
                  )}

                  <TextField
                    label="Dica para quem preenche (opcional)"
                    icon={<BoxIcon className="h-4 w-4" />}
                    value={row.help}
                    onChange={(event) => updateVariable(row.rowKey, { help: event.target.value })}
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() => setVarRows((current) => [...current, newVariable({ options: [newOption({ label: 'Sim', value: '1' }), newOption({ label: 'Não', value: '0' })] })])}
                className="flex w-fit items-center gap-1.5 rounded-xl border border-[var(--border)] px-3.5 py-2 text-[12.5px] font-bold text-[var(--ink-soft)] hover:text-[var(--ink)]"
              >
                <PlusIcon className="h-3.5 w-3.5" /> Variável
              </button>
            </div>
          </SectionCard>

          <SectionCard
            title="Perfis, acessórios e ferragens"
            subtitle="Cada linha soma ao preço da peça. Perfis e acessórios usam o catálogo e fórmulas; ferragens usam valor digitado"
          >
            <div className="flex flex-col gap-3">
              <p className="rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[12px] text-[var(--ink-soft)]">
                Nas fórmulas use <b>L</b> (largura do vão, mm), <b>H</b> (altura, mm), <b>F</b> (folhas), <b>A</b> (área, m²) e{' '}
                <b>P</b> (perímetro, m) e as chaves das variáveis do modelo, com + − × ÷, parênteses e ceil, floor, round, max, min. Ex.: <b>(L / F) - 20</b> ou <b>L - FOLGA_L</b>
              </p>
              {rows.length === 0 && (
                <p className="text-[13px] text-[var(--muted)]">Nenhuma linha. Adicione perfis, acessórios ou ferragens.</p>
              )}
              {rows.map((row) => (
                <div key={row.key} className="grid items-end gap-3 rounded-xl bg-[var(--page)] p-3 sm:grid-cols-[1.3fr_2fr_1.2fr_1fr_auto]">
                  <SelectField
                    label="Tipo"
                    variant="surface"
                    value={row.kind}
                    onChange={(event) => updateRow(row.key, { kind: event.target.value as GlassComponentKind })}
                  >
                    {(Object.keys(KIND_LABELS) as GlassComponentKind[]).map((kind) => (
                      <option key={kind} value={kind}>
                        {KIND_LABELS[kind]}
                      </option>
                    ))}
                  </SelectField>

                  {row.kind === 'profile' && (
                    <>
                      <SelectField
                        label="Perfil"
                        variant="surface"
                        value={row.profileId}
                        onChange={(event) => updateRow(row.key, { profileId: event.target.value })}
                      >
                        <option value="">Selecione</option>
                        {profiles.map((profile) => (
                          <option key={profile.id} value={profile.id}>
                            {[profile.name, profile.color].filter(Boolean).join(' · ')}
                          </option>
                        ))}
                      </SelectField>
                      <TextField
                        label="Comprimento da peça (mm)"
                        icon={<TagIcon className="h-4 w-4" />}
                        placeholder="Ex: L - 45"
                        value={row.lengthFormula}
                        onChange={(event) => updateRow(row.key, { lengthFormula: event.target.value })}
                      />
                      <TextField
                        label="Quantidade de peças"
                        icon={<TagIcon className="h-4 w-4" />}
                        placeholder="Ex: 2"
                        value={row.quantityFormula}
                        onChange={(event) => updateRow(row.key, { quantityFormula: event.target.value })}
                      />
                    </>
                  )}

                  {row.kind === 'accessory' && (
                    <>
                      <SelectField
                        label="Acessório"
                        variant="surface"
                        value={row.accessoryId}
                        onChange={(event) => updateRow(row.key, { accessoryId: event.target.value })}
                      >
                        <option value="">Selecione</option>
                        {accessories.map((accessory) => (
                          <option key={accessory.id} value={accessory.id}>
                            {accessory.name} ({accessory.unit})
                          </option>
                        ))}
                      </SelectField>
                      <TextField
                        label="Quantidade"
                        icon={<TagIcon className="h-4 w-4" />}
                        placeholder="Ex: F * 2"
                        value={row.quantityFormula}
                        onChange={(event) => updateRow(row.key, { quantityFormula: event.target.value })}
                      />
                      <span />
                    </>
                  )}

                  {row.kind === 'free' && (
                    <>
                      <TextField
                        label="Item"
                        icon={<BoxIcon className="h-4 w-4" />}
                        placeholder="Ex: Fechadura"
                        value={row.name}
                        onChange={(event) => updateRow(row.key, { name: event.target.value })}
                      />
                      <SelectField
                        label="Cobrança"
                        variant="surface"
                        value={row.mode}
                        onChange={(event) => updateRow(row.key, { mode: event.target.value as ComponentRow['mode'] })}
                      >
                        {GLASS_COMPONENT_MODES.map((mode) => (
                          <option key={mode.value} value={mode.value}>
                            {mode.label}
                          </option>
                        ))}
                      </SelectField>
                      <div className="grid grid-cols-2 gap-2">
                        <TextField
                          label="Qtd"
                          icon={<TagIcon className="h-4 w-4" />}
                          inputMode="decimal"
                          value={row.quantity}
                          onChange={(event) => updateRow(row.key, { quantity: event.target.value.replace(/[^\d,.]/g, '') })}
                        />
                        <MoneyField
                          label="Valor"
                          icon={<CoinIcon className="h-4 w-4" />}
                          value={row.unitValue}
                          onChange={(event) => updateRow(row.key, { unitValue: event.target.value })}
                        />
                      </div>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}
                    className="mb-1 flex h-9 w-9 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--red-100)] hover:text-[var(--red-500)]"
                    aria-label="Remover linha"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                  <div className="grid gap-3 sm:col-span-full sm:grid-cols-2">
                    {row.kind === 'profile' && varRows.some((variable) => variable.type === 'select' && toVariable(variable)) && (
                      <SelectField
                        label="Perfil escolhido pela variável (opcional)"
                        variant="surface"
                        value={row.profileVariable}
                        onChange={(event) => updateRow(row.key, { profileVariable: event.target.value })}
                      >
                        <option value="">Sempre o perfil acima</option>
                        {simulationVariables
                          .filter((variable) => variable.type === 'select')
                          .map((variable) => (
                            <option key={variable.key} value={variable.key}>
                              {variable.key} — {variable.label}
                            </option>
                          ))}
                      </SelectField>
                    )}
                    {row.kind === 'accessory' && varRows.some((variable) => variable.type === 'select' && toVariable(variable)) && (
                      <SelectField
                        label="Acessório escolhido pela variável (opcional)"
                        variant="surface"
                        value={row.accessoryVariable}
                        onChange={(event) => updateRow(row.key, { accessoryVariable: event.target.value })}
                      >
                        <option value="">Sempre o acessório acima</option>
                        {simulationVariables
                          .filter((variable) => variable.type === 'select')
                          .map((variable) => (
                            <option key={variable.key} value={variable.key}>
                              {variable.key} — {variable.label}
                            </option>
                          ))}
                      </SelectField>
                    )}
                    {simulationVariables.length > 0 && (
                      <TextField
                        label="Só entra quando (fórmula, opcional)"
                        icon={<TagIcon className="h-4 w-4" />}
                        placeholder="Ex: T (entra se T for diferente de zero)"
                        value={row.condition}
                        onChange={(event) => updateRow(row.key, { condition: event.target.value })}
                      />
                    )}
                  </div>
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                {(['profile', 'accessory', 'free'] as GlassComponentKind[]).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => setRows((current) => [...current, newRow({ kind })])}
                    className="flex w-fit items-center gap-1.5 rounded-xl border border-[var(--border)] px-3.5 py-2 text-[12.5px] font-bold text-[var(--ink-soft)] hover:text-[var(--ink)]"
                  >
                    <PlusIcon className="h-3.5 w-3.5" />
                    {kind === 'profile' ? 'Perfil' : kind === 'accessory' ? 'Acessório' : 'Ferragem'}
                  </button>
                ))}
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Simulação"
            subtitle="Confira as fórmulas com uma medida de exemplo (valores de venda do catálogo, sem vidro nem mão de obra)"
            defaultCollapsed={rows.length === 0}
          >
            <div className="grid gap-4 sm:grid-cols-2 xl:max-w-[520px]">
              <TextField
                label="Largura (mm)"
                icon={<TagIcon className="h-4 w-4" />}
                inputMode="numeric"
                value={sampleWidth}
                onChange={(event) => setSampleWidth(event.target.value.replace(/\D/g, ''))}
              />
              <TextField
                label="Altura (mm)"
                icon={<TagIcon className="h-4 w-4" />}
                inputMode="numeric"
                value={sampleHeight}
                onChange={(event) => setSampleHeight(event.target.value.replace(/\D/g, ''))}
              />
            </div>
            {simulationError && (
              <p className="mt-3 rounded-xl bg-[var(--red-100)] px-4 py-2.5 text-[13px] font-medium text-[var(--red-500)]">
                {simulationError}
              </p>
            )}
            {simulation && (
              <div className="mt-3 rounded-xl bg-[var(--page)] p-3">
                <table className="w-full border-collapse text-[13px]">
                  <tbody>
                    {simulation.rows.map((row, index) => (
                      <tr key={index} className="border-b border-[var(--border)] last:border-none">
                        <td className="py-1.5 text-[var(--ink)]">
                          {row.name}
                          {row.error && <span className="ml-2 text-[12px] text-[var(--red-500)]">{row.error}</span>}
                        </td>
                        <td className="py-1.5 text-right font-semibold">{formatCurrency(row.value)}</td>
                      </tr>
                    ))}
                    <tr>
                      <td className="pt-2 font-bold text-[var(--ink)]">Total das linhas</td>
                      <td className="pt-2 text-right font-bold text-[var(--ink)]">{formatCurrency(simulation.total)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          {error && (
            <p className="rounded-xl bg-[var(--red-100)] px-4 py-3 text-[13.5px] font-medium text-[var(--red-500)]">{error}</p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-[var(--blue-500)] px-6 py-2.5 text-[14px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:opacity-60"
            >
              {submitting ? 'Salvando…' : 'Salvar'}
            </button>
            <button
              type="button"
              onClick={onBack}
              className="rounded-xl px-5 py-2.5 text-[14px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
