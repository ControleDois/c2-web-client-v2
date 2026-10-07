import { useEffect, useState, type FormEvent } from 'react'
import { createGlassAccessory, fetchGlassAccessory, updateGlassAccessory } from '../../lib/glass'
import { parseMoney } from '../../lib/money'
import { ApiError } from '../../lib/api'
import { TextField } from '../../components/form/TextField'
import { MoneyField } from '../../components/form/MoneyField'
import { SelectField } from '../../components/form/SelectField'
import { TagIcon, CoinIcon, ChevronLeftIcon, BoxIcon } from '../../components/icons'
import type { AuthSession, AuthCompany } from '../../lib/auth'

interface GlassAccessoryFormPageProps {
  session: AuthSession
  company: AuthCompany
  accessoryId?: string
  onBack: () => void
  onSaved: () => void
}

const UNITS = ['un', 'm', 'kit', 'par', 'cx', 'kg']

export function GlassAccessoryFormPage({ session, company, accessoryId, onBack, onSaved }: GlassAccessoryFormPageProps) {
  const [loading, setLoading] = useState(Boolean(accessoryId))
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [reference, setReference] = useState('')
  const [unit, setUnit] = useState('un')
  const [price, setPrice] = useState('')
  const [cost, setCost] = useState('')
  const [active, setActive] = useState(true)

  useEffect(() => {
    if (!accessoryId) return
    let cancelled = false
    fetchGlassAccessory(session.token.token, accessoryId)
      .then((item) => {
        if (cancelled) return
        setName(item.name)
        setReference(item.reference ?? '')
        setUnit(item.unit)
        setPrice(String(item.price ?? ''))
        setCost(String(item.cost ?? ''))
        setActive(item.active)
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof ApiError ? err.message : 'Não foi possível carregar o acessório.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [accessoryId, session.token.token])

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
      unit,
      price: parseMoney(price) ?? 0,
      cost: parseMoney(cost) ?? 0,
      active,
    }

    setSubmitting(true)
    try {
      if (accessoryId) await updateGlassAccessory(session.token.token, accessoryId, payload)
      else await createGlassAccessory(session.token.token, payload)
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar o acessório.')
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
          Voltar para acessórios
        </button>
        <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Vidraçaria</p>
        <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">{accessoryId ? 'Editar acessório' : 'Novo acessório'}</h1>
      </div>

      {loading ? (
        <div className="h-11 animate-pulse rounded-xl bg-[var(--surface)]" />
      ) : loadError ? (
        <p className="rounded-2xl bg-[var(--red-100)] p-5 text-[13.5px] font-medium text-[var(--red-500)]">{loadError}</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="mb-4 text-[14px] font-bold text-[var(--ink)]">Dados do acessório</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <TextField label="Nome" icon={<BoxIcon className="h-4 w-4" />} placeholder="Ex: Roldana de nylon" value={name} onChange={(event) => setName(event.target.value)} />
              <TextField label="Referência / código" icon={<TagIcon className="h-4 w-4" />} value={reference} onChange={(event) => setReference(event.target.value)} />
              <SelectField label="Unidade" value={unit} onChange={(event) => setUnit(event.target.value)}>
                {UNITS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </SelectField>
              <MoneyField label="Preço de venda (por unidade)" icon={<CoinIcon className="h-4 w-4" />} value={price} onChange={(event) => setPrice(event.target.value)} />
              <MoneyField label="Custo (por unidade)" icon={<CoinIcon className="h-4 w-4" />} value={cost} onChange={(event) => setCost(event.target.value)} />
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
