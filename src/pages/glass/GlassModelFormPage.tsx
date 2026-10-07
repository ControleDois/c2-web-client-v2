import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { formatCurrency } from '../../lib/format'
import {
  createGlassModel,
  fetchGlassModel,
  fetchGlassAccessories,
  fetchGlassProfiles,
  fetchGlassTypes,
  simulateGlassModel,
  updateGlassModel,
  GLASS_CATEGORIES,
  GLASS_COMPONENT_MODES,
  type GlassAccessoryRecord,
  type GlassComponent,
  type GlassComponentKind,
  type GlassModelRecord,
  type GlassProfileRecord,
  type GlassSimulationRow,
  type GlassTypeRecord,
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
}

const KIND_LABELS: Record<GlassComponentKind, string> = {
  free: 'Ferragem (valor fixo)',
  profile: 'Perfil (fórmula)',
  accessory: 'Acessório (fórmula)',
}

function toComponent(row: ComponentRow): GlassComponent | null {
  if (row.kind === 'profile') {
    if (!row.profileId) return null
    return {
      kind: 'profile',
      name: row.name.trim() || 'Perfil',
      profile_id: row.profileId,
      length_formula: row.lengthFormula.trim(),
      quantity_formula: row.quantityFormula.trim() || '1',
    }
  }
  if (row.kind === 'accessory') {
    if (!row.accessoryId) return null
    return {
      kind: 'accessory',
      name: row.name.trim() || 'Acessório',
      accessory_id: row.accessoryId,
      quantity_formula: row.quantityFormula.trim() || '1',
    }
  }
  if (!row.name.trim()) return null
  return {
    kind: 'free',
    name: row.name.trim(),
    mode: row.mode,
    quantity: Number(row.quantity.replace(',', '.')) || 0,
    unit_value: parseMoney(row.unitValue) ?? 0,
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
  const [defaultGlassTypeId, setDefaultGlassTypeId] = useState('')
  const [laborPerM2, setLaborPerM2] = useState('')
  const [laborFixed, setLaborFixed] = useState('')
  const [cutWidthDiscount, setCutWidthDiscount] = useState('')
  const [cutHeightDiscount, setCutHeightDiscount] = useState('')
  const [active, setActive] = useState(true)
  const [product, setProduct] = useState<{ id: string; name: string } | null>(null)
  const [rows, setRows] = useState<ComponentRow[]>([])
  const [profiles, setProfiles] = useState<GlassProfileRecord[]>([])
  const [accessories, setAccessories] = useState<GlassAccessoryRecord[]>([])
  const [sampleWidth, setSampleWidth] = useState('1500')
  const [sampleHeight, setSampleHeight] = useState('1000')
  const [simulation, setSimulation] = useState<{ rows: GlassSimulationRow[]; total: number } | null>(null)
  const [simulationError, setSimulationError] = useState<string | null>(null)

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
        setDefaultGlassTypeId(item.default_glass_type_id ?? '')
        setLaborPerM2(String(item.labor_per_m2 ?? ''))
        setLaborFixed(String(item.labor_fixed ?? ''))
        setCutWidthDiscount(item.cut_width_discount_mm ? String(item.cut_width_discount_mm) : '')
        setCutHeightDiscount(item.cut_height_discount_mm ? String(item.cut_height_discount_mm) : '')
        setActive(item.active)
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
  }, [session.token.token, company.id, simulationComponents, sampleWidth, sampleHeight, folhas])

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
      default_glass_type_id: defaultGlassTypeId || null,
      labor_per_m2: parseMoney(laborPerM2) ?? 0,
      labor_fixed: parseMoney(laborFixed) ?? 0,
      cut_width_discount_mm: Number(cutWidthDiscount) || 0,
      product_id: product?.id ?? null,
      cut_height_discount_mm: Number(cutHeightDiscount) || 0,
      active,
      components,
    }

    setSubmitting(true)
    try {
      if (glassModelId) await updateGlassModel(session.token.token, glassModelId, payload)
      else await createGlassModel(session.token.token, payload)
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
            title="Perfis, acessórios e ferragens"
            subtitle="Cada linha soma ao preço da peça. Perfis e acessórios usam o catálogo e fórmulas; ferragens usam valor digitado"
          >
            <div className="flex flex-col gap-3">
              <p className="rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[12px] text-[var(--ink-soft)]">
                Nas fórmulas use <b>L</b> (largura do vão, mm), <b>H</b> (altura, mm), <b>F</b> (folhas), <b>A</b> (área, m²) e{' '}
                <b>P</b> (perímetro, m), com + − × ÷, parênteses e ceil, floor, round, max, min. Ex.: <b>(L / F) - 20</b>
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
