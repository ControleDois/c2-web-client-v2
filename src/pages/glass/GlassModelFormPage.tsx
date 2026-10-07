import { useEffect, useState, type FormEvent } from 'react'
import {
  createGlassModel,
  fetchGlassModel,
  fetchGlassTypes,
  updateGlassModel,
  GLASS_CATEGORIES,
  GLASS_COMPONENT_MODES,
  type GlassComponent,
  type GlassModelRecord,
  type GlassTypeRecord,
} from '../../lib/glass'
import { parseMoney } from '../../lib/money'
import { ApiError } from '../../lib/api'
import { TextField } from '../../components/form/TextField'
import { MoneyField } from '../../components/form/MoneyField'
import { SelectField } from '../../components/form/SelectField'
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
  name: string
  mode: GlassComponent['mode']
  quantity: string
  unitValue: string
}

let rowCounter = 0
const newRow = (partial: Partial<ComponentRow> = {}): ComponentRow => ({
  key: `row-${++rowCounter}`,
  name: '',
  mode: 'fixed',
  quantity: '1',
  unitValue: '',
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
  const [rows, setRows] = useState<ComponentRow[]>([])

  useEffect(() => {
    fetchGlassTypes(session.token.token, company.id, { limit: 200, active: true })
      .then((res) => setGlassTypes(res.data || []))
      .catch(() => setGlassTypes([]))
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
        setRows(
          (item.components ?? []).map((component) =>
            newRow({
              name: component.name,
              mode: component.mode,
              quantity: String(component.quantity).replace('.', ','),
              unitValue: String(component.unit_value),
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

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError('Preencha o nome para continuar.')
      return
    }
    const filledRows = rows.filter((row) => row.name.trim())

    const payload = {
      company_id: company.id,
      name: name.trim(),
      category,
      folhas: Math.max(Number(folhas) || 1, 1),
      default_glass_type_id: defaultGlassTypeId || null,
      labor_per_m2: parseMoney(laborPerM2) ?? 0,
      labor_fixed: parseMoney(laborFixed) ?? 0,
      cut_width_discount_mm: Number(cutWidthDiscount) || 0,
      cut_height_discount_mm: Number(cutHeightDiscount) || 0,
      active,
      components: filledRows.map((row) => ({
        name: row.name.trim(),
        mode: row.mode,
        quantity: Number(row.quantity.replace(',', '.')) || 0,
        unit_value: parseMoney(row.unitValue) ?? 0,
      })),
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
            title="Ferragens e acessórios"
            subtitle="Cada linha soma ao preço da peça: valor fixo, por m² ou por metro de perímetro"
          >
            <div className="flex flex-col gap-3">
              {rows.length === 0 && (
                <p className="text-[13px] text-[var(--muted)]">Nenhuma ferragem. Adicione roldanas, fechaduras, trilhos…</p>
              )}
              {rows.map((row) => (
                <div key={row.key} className="grid items-end gap-3 rounded-xl bg-[var(--page)] p-3 sm:grid-cols-[2fr_1.4fr_0.7fr_1fr_auto]">
                  <TextField
                    label="Item"
                    icon={<BoxIcon className="h-4 w-4" />}
                    placeholder="Ex: Roldana"
                    value={row.name}
                    onChange={(event) => updateRow(row.key, { name: event.target.value })}
                  />
                  <SelectField
                    label="Cobrança"
                    variant="surface"
                    value={row.mode}
                    onChange={(event) => updateRow(row.key, { mode: event.target.value as GlassComponent['mode'] })}
                  >
                    {GLASS_COMPONENT_MODES.map((mode) => (
                      <option key={mode.value} value={mode.value}>
                        {mode.label}
                      </option>
                    ))}
                  </SelectField>
                  <TextField
                    label="Qtd"
                    icon={<TagIcon className="h-4 w-4" />}
                    inputMode="decimal"
                    value={row.quantity}
                    onChange={(event) => updateRow(row.key, { quantity: event.target.value.replace(/[^\d,.]/g, '') })}
                  />
                  <MoneyField
                    label="Valor unitário"
                    icon={<CoinIcon className="h-4 w-4" />}
                    value={row.unitValue}
                    onChange={(event) => updateRow(row.key, { unitValue: event.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}
                    className="mb-1 flex h-9 w-9 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--red-100)] hover:text-[var(--red-500)]"
                    aria-label="Remover ferragem"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setRows((current) => [...current, newRow()])}
                className="flex w-fit items-center gap-1.5 rounded-xl border border-[var(--border)] px-3.5 py-2 text-[12.5px] font-bold text-[var(--ink-soft)] hover:text-[var(--ink)]"
              >
                <PlusIcon className="h-3.5 w-3.5" />
                Adicionar ferragem
              </button>
            </div>
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
