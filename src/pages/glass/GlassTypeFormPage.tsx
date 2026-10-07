import { useEffect, useState, type FormEvent } from 'react'
import {
  createGlassType,
  fetchGlassType,
  updateGlassType,
  GLASS_KINDS,
  type GlassTypeRecord,
} from '../../lib/glass'
import { parseMoney } from '../../lib/money'
import { ApiError } from '../../lib/api'
import { TextField } from '../../components/form/TextField'
import { MoneyField } from '../../components/form/MoneyField'
import { SelectField } from '../../components/form/SelectField'
import { FiscalProductField } from '../../components/form/FiscalProductField'
import { TagIcon, CoinIcon, ChevronLeftIcon, BoxIcon } from '../../components/icons'
import type { AuthSession, AuthCompany } from '../../lib/auth'

interface GlassTypeFormPageProps {
  session: AuthSession
  company: AuthCompany
  glassTypeId?: string
  onBack: () => void
  onSaved: () => void
}

export function GlassTypeFormPage({ session, company, glassTypeId, onBack, onSaved }: GlassTypeFormPageProps) {
  const [loading, setLoading] = useState(Boolean(glassTypeId))
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [kind, setKind] = useState('comum')
  const [thickness, setThickness] = useState('')
  const [color, setColor] = useState('')
  const [pricePerM2, setPricePerM2] = useState('')
  const [costPerM2, setCostPerM2] = useState('')
  const [minArea, setMinArea] = useState('')
  const [sheetWidth, setSheetWidth] = useState('')
  const [sheetHeight, setSheetHeight] = useState('')
  const [active, setActive] = useState(true)
  const [product, setProduct] = useState<{ id: string; name: string } | null>(null)

  useEffect(() => {
    if (!glassTypeId) return
    let cancelled = false
    fetchGlassType(session.token.token, glassTypeId)
      .then((item: GlassTypeRecord) => {
        if (cancelled) return
        setName(item.name)
        setKind(item.kind)
        setThickness(item.thickness_mm ? String(item.thickness_mm) : '')
        setColor(item.color ?? '')
        setPricePerM2(String(item.price_per_m2 ?? ''))
        setCostPerM2(String(item.cost_per_m2 ?? ''))
        setMinArea(item.min_area_m2 ? String(item.min_area_m2).replace('.', ',') : '')
        setSheetWidth(item.sheet_width_mm ? String(item.sheet_width_mm) : '')
        setSheetHeight(item.sheet_height_mm ? String(item.sheet_height_mm) : '')
        setActive(item.active)
        setProduct(item.product ? { id: item.product.id, name: item.product.name } : null)
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof ApiError ? err.message : 'Não foi possível carregar o vidro.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [glassTypeId, session.token.token])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError('Preencha o nome para continuar.')
      return
    }

    const payload = {
      company_id: company.id,
      name: name.trim(),
      kind,
      thickness_mm: thickness ? Number(thickness) : undefined,
      color: color.trim() || null,
      price_per_m2: parseMoney(pricePerM2) ?? 0,
      cost_per_m2: parseMoney(costPerM2) ?? 0,
      min_area_m2: Number(minArea.replace(',', '.')) || 0,
      sheet_width_mm: sheetWidth ? Number(sheetWidth) : null,
      sheet_height_mm: sheetHeight ? Number(sheetHeight) : null,
      product_id: product?.id ?? null,
      active,
    }

    setSubmitting(true)
    try {
      if (glassTypeId) await updateGlassType(session.token.token, glassTypeId, payload)
      else await createGlassType(session.token.token, payload)
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar o vidro.')
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
          Voltar para vidros
        </button>
        <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Vidraçaria</p>
        <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">
          {glassTypeId ? 'Editar vidro' : 'Novo vidro'}
        </h1>
      </div>

      {loading ? (
        <div className="h-11 animate-pulse rounded-xl bg-[var(--surface)]" />
      ) : loadError ? (
        <p className="rounded-2xl bg-[var(--red-100)] p-5 text-[13.5px] font-medium text-[var(--red-500)]">{loadError}</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="mb-1 text-[14px] font-bold text-[var(--ink)]">Dados do vidro</h2>
            <p className="mb-4 text-[12px] text-[var(--muted)]">
              O preço por m² multiplica a área da peça. A área mínima faz peças pequenas serem cobradas como se
              tivessem esse tamanho.
            </p>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <TextField
                label="Nome"
                icon={<BoxIcon className="h-4 w-4" />}
                placeholder="Ex: Temperado incolor 8mm"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              <SelectField label="Tipo" value={kind} onChange={(event) => setKind(event.target.value)}>
                {GLASS_KINDS.map((item) => (
                  <option key={item} value={item}>
                    {item.charAt(0).toUpperCase() + item.slice(1)}
                  </option>
                ))}
              </SelectField>
              <TextField
                label="Espessura (mm)"
                icon={<TagIcon className="h-4 w-4" />}
                inputMode="numeric"
                placeholder="8"
                value={thickness}
                onChange={(event) => setThickness(event.target.value.replace(/\D/g, ''))}
              />
              <TextField
                label="Cor"
                icon={<TagIcon className="h-4 w-4" />}
                placeholder="Incolor, fumê, verde..."
                value={color}
                onChange={(event) => setColor(event.target.value)}
              />
              <MoneyField
                label="Preço de venda por m²"
                icon={<CoinIcon className="h-4 w-4" />}
                value={pricePerM2}
                onChange={(event) => setPricePerM2(event.target.value)}
              />
              <MoneyField
                label="Custo por m²"
                icon={<CoinIcon className="h-4 w-4" />}
                value={costPerM2}
                onChange={(event) => setCostPerM2(event.target.value)}
              />
              <TextField
                label="Área mínima cobrada (m²)"
                icon={<TagIcon className="h-4 w-4" />}
                inputMode="decimal"
                placeholder="0,50"
                value={minArea}
                onChange={(event) => setMinArea(event.target.value.replace(/[^\d,.]/g, ''))}
              />
              <TextField
                label="Chapa — largura (mm)"
                icon={<TagIcon className="h-4 w-4" />}
                inputMode="numeric"
                placeholder="2200"
                value={sheetWidth}
                onChange={(event) => setSheetWidth(event.target.value.replace(/\D/g, ''))}
              />
              <TextField
                label="Chapa — altura (mm)"
                icon={<TagIcon className="h-4 w-4" />}
                inputMode="numeric"
                placeholder="3210"
                value={sheetHeight}
                onChange={(event) => setSheetHeight(event.target.value.replace(/\D/g, ''))}
              />
              <FiscalProductField session={session} company={company} value={product} onChange={setProduct} />
            </div>
            <p className="mt-2 text-[11.5px] text-[var(--muted)]">
              O tamanho da chapa é usado no plano de corte. Em branco, vale 2200 × 3210 mm.
            </p>
            <p className="mt-2 text-[11.5px] text-[var(--muted)]">
              O produto fiscal fornece NCM e tributação ao emitir a NF-e dos itens que usam este vidro (o do modelo tem prioridade).
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
          </div>

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
