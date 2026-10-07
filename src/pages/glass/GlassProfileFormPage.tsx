import { useEffect, useState, type FormEvent } from 'react'
import { createGlassProfile, fetchGlassProfile, updateGlassProfile } from '../../lib/glass'
import { parseMoney } from '../../lib/money'
import { ApiError } from '../../lib/api'
import { TextField } from '../../components/form/TextField'
import { MoneyField } from '../../components/form/MoneyField'
import { TagIcon, CoinIcon, ChevronLeftIcon, BoxIcon } from '../../components/icons'
import type { AuthSession, AuthCompany } from '../../lib/auth'

interface GlassProfileFormPageProps {
  session: AuthSession
  company: AuthCompany
  profileId?: string
  onBack: () => void
  onSaved: () => void
}

export function GlassProfileFormPage({ session, company, profileId, onBack, onSaved }: GlassProfileFormPageProps) {
  const [loading, setLoading] = useState(Boolean(profileId))
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [reference, setReference] = useState('')
  const [line, setLine] = useState('')
  const [color, setColor] = useState('')
  const [barLength, setBarLength] = useState('6000')
  const [pricePerM, setPricePerM] = useState('')
  const [costPerM, setCostPerM] = useState('')
  const [active, setActive] = useState(true)

  useEffect(() => {
    if (!profileId) return
    let cancelled = false
    fetchGlassProfile(session.token.token, profileId)
      .then((item) => {
        if (cancelled) return
        setName(item.name)
        setReference(item.reference ?? '')
        setLine(item.line ?? '')
        setColor(item.color ?? '')
        setBarLength(String(item.bar_length_mm))
        setPricePerM(String(item.price_per_m ?? ''))
        setCostPerM(String(item.cost_per_m ?? ''))
        setActive(item.active)
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof ApiError ? err.message : 'Não foi possível carregar o perfil.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [profileId, session.token.token])

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
      reference: reference.trim() || null,
      line: line.trim() || null,
      color: color.trim() || null,
      bar_length_mm: Math.max(Number(barLength) || 6000, 1),
      price_per_m: parseMoney(pricePerM) ?? 0,
      cost_per_m: parseMoney(costPerM) ?? 0,
      active,
    }

    setSubmitting(true)
    try {
      if (profileId) await updateGlassProfile(session.token.token, profileId, payload)
      else await createGlassProfile(session.token.token, payload)
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar o perfil.')
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
          Voltar para perfis
        </button>
        <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Vidraçaria</p>
        <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">{profileId ? 'Editar perfil' : 'Novo perfil'}</h1>
      </div>

      {loading ? (
        <div className="h-11 animate-pulse rounded-xl bg-[var(--surface)]" />
      ) : loadError ? (
        <p className="rounded-2xl bg-[var(--red-100)] p-5 text-[13.5px] font-medium text-[var(--red-500)]">{loadError}</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="mb-1 text-[14px] font-bold text-[var(--ink)]">Dados do perfil</h2>
            <p className="mb-4 text-[12px] text-[var(--muted)]">
              O preço por metro multiplica o comprimento das peças calculadas nas fórmulas do modelo. O tamanho da barra
              será usado no plano de corte.
            </p>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <TextField label="Nome" icon={<BoxIcon className="h-4 w-4" />} placeholder="Ex: Marco superior 2 folhas" value={name} onChange={(event) => setName(event.target.value)} />
              <TextField label="Referência / código do fornecedor" icon={<TagIcon className="h-4 w-4" />} value={reference} onChange={(event) => setReference(event.target.value)} />
              <TextField label="Linha / fornecedor" icon={<TagIcon className="h-4 w-4" />} placeholder="Ex: Suprema" value={line} onChange={(event) => setLine(event.target.value)} />
              <TextField label="Cor / acabamento" icon={<TagIcon className="h-4 w-4" />} placeholder="Ex: Branco, Fosco" value={color} onChange={(event) => setColor(event.target.value)} />
              <TextField
                label="Tamanho da barra (mm)"
                icon={<TagIcon className="h-4 w-4" />}
                inputMode="numeric"
                value={barLength}
                onChange={(event) => setBarLength(event.target.value.replace(/\D/g, ''))}
              />
              <span />
              <MoneyField label="Preço de venda por metro" icon={<CoinIcon className="h-4 w-4" />} value={pricePerM} onChange={(event) => setPricePerM(event.target.value)} />
              <MoneyField label="Custo por metro" icon={<CoinIcon className="h-4 w-4" />} value={costPerM} onChange={(event) => setCostPerM(event.target.value)} />
            </div>
            <label className="mt-4 flex items-center gap-2.5">
              <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} className="h-4 w-4 accent-[var(--blue-500)]" />
              <span className="text-[13.5px] font-semibold text-[var(--ink)]">Ativo (aparece nos modelos)</span>
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
