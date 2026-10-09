import { useEffect, useState, type FormEvent } from 'react'
import { createGlassColor, fetchGlassColor, GLASS_COLOR_KIND_LABELS, updateGlassColor, type GlassColorKind } from '../../lib/glass'
import { ApiError } from '../../lib/api'
import { TextField } from '../../components/form/TextField'
import { SelectField } from '../../components/form/SelectField'
import { TagIcon, ChevronLeftIcon, BoxIcon } from '../../components/icons'
import type { AuthSession, AuthCompany } from '../../lib/auth'

interface GlassColorFormPageProps {
  session: AuthSession
  company: AuthCompany
  colorId?: string
  onBack: () => void
  onSaved: () => void
}

export function GlassColorFormPage({ session, company, colorId, onBack, onSaved }: GlassColorFormPageProps) {
  const [loading, setLoading] = useState(Boolean(colorId))
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<GlassColorKind>('profile')
  const [adjust, setAdjust] = useState('')
  const [active, setActive] = useState(true)

  useEffect(() => {
    if (!colorId) return
    let cancelled = false
    fetchGlassColor(session.token.token, colorId)
      .then((item) => {
        if (cancelled) return
        setName(item.name)
        setKind(item.kind)
        setAdjust(item.price_adjust_percent ? String(item.price_adjust_percent).replace('.', ',') : '')
        setActive(item.active)
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof ApiError ? err.message : 'Não foi possível carregar a cor.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [colorId, session.token.token])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (!name.trim()) return setError('Preencha o nome para continuar.')
    const percent = Number(adjust.replace(',', '.')) || 0
    const payload = { company_id: company.id, name: name.trim(), kind, price_adjust_percent: percent, active }

    setSubmitting(true)
    try {
      if (colorId) await updateGlassColor(session.token.token, colorId, payload)
      else await createGlassColor(session.token.token, payload)
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar a cor.')
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
          Voltar para cores
        </button>
        <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Vidraçaria</p>
        <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">{colorId ? 'Editar cor' : 'Nova cor'}</h1>
      </div>

      {loading ? (
        <div className="h-11 animate-pulse rounded-xl bg-[var(--surface)]" />
      ) : loadError ? (
        <p className="rounded-2xl bg-[var(--red-100)] p-5 text-[13.5px] font-medium text-[var(--red-500)]">{loadError}</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="mb-4 text-[14px] font-bold text-[var(--ink)]">Dados da cor</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <TextField label="Nome" icon={<BoxIcon className="h-4 w-4" />} placeholder="Ex: Preto, Bronze, Branco" value={name} onChange={(event) => setName(event.target.value)} />
              <SelectField label="Vale para" value={kind} onChange={(event) => setKind(event.target.value as GlassColorKind)}>
                {(Object.keys(GLASS_COLOR_KIND_LABELS) as GlassColorKind[]).map((key) => (
                  <option key={key} value={key}>
                    {GLASS_COLOR_KIND_LABELS[key]}
                  </option>
                ))}
              </SelectField>
              <TextField
                label="Acréscimo no preço (%)"
                icon={<TagIcon className="h-4 w-4" />}
                inputMode="decimal"
                placeholder="Ex: 15 (negativo dá desconto)"
                value={adjust}
                onChange={(event) => setAdjust(event.target.value.replace(/[^\d,.-]/g, ''))}
              />
            </div>
            <p className="mt-2 text-[11.5px] text-[var(--muted)]">
              O acréscimo vale sobre os perfis (cor do alumínio) ou sobre os acessórios (cor dos acessórios) do item, no preço e no custo.
              Deixe em branco se a cor não muda o valor.
            </p>
            <label className="mt-4 flex items-center gap-2.5">
              <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} className="h-4 w-4 accent-[var(--blue-500)]" />
              <span className="text-[13.5px] font-semibold text-[var(--ink)]">Ativa (aparece nos itens do pedido)</span>
            </label>
          </div>

          {error && <p className="rounded-xl bg-[var(--red-100)] px-4 py-3 text-[13.5px] font-medium text-[var(--red-500)]">{error}</p>}

          <div className="flex items-center gap-3">
            <button type="submit" disabled={submitting} className="rounded-xl bg-[var(--blue-500)] px-6 py-2.5 text-[14px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:opacity-60">
              {submitting ? 'Salvando…' : 'Salvar'}
            </button>
            <button type="button" onClick={onBack} className="rounded-xl px-5 py-2.5 text-[14px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]">
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
