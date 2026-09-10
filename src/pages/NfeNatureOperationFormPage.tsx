import { useEffect, useState, type FormEvent } from 'react'
import {
  createNfeNatureOperation,
  fetchNfeNatureOperation,
  updateNfeNatureOperation,
  NFE_NATURE_OPERATION_FINALITY_LABELS,
  type NfeNatureOperationRecord,
} from '../lib/nfeNatureOperations'
import { ApiError } from '../lib/api'
import { TextField } from '../components/form/TextField'
import { SelectField } from '../components/form/SelectField'
import { TagIcon, ChevronLeftIcon } from '../components/icons'
import type { AuthSession, AuthCompany } from '../lib/auth'

interface NfeNatureOperationFormPageProps {
  session: AuthSession
  company: AuthCompany
  natureOperationId?: string
  onBack: () => void
  onSaved: () => void
}

export function NfeNatureOperationFormPage({
  session,
  company,
  natureOperationId,
  onBack,
  onSaved,
}: NfeNatureOperationFormPageProps) {
  const [loading, setLoading] = useState(Boolean(natureOperationId))
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [description, setDescription] = useState('')
  const [finality, setFinality] = useState(1)
  const [cfopState, setCfopState] = useState('')
  const [cfopInterstate, setCfopInterstate] = useState('')

  useEffect(() => {
    if (!natureOperationId) return
    let cancelled = false
    setLoading(true)
    setLoadError(null)

    fetchNfeNatureOperation(session.token.token, natureOperationId)
      .then((item: NfeNatureOperationRecord) => {
        if (cancelled) return
        setDescription(item.description ?? '')
        setFinality(item.finality ?? 1)
        setCfopState(item.cfop_state ?? '')
        setCfopInterstate(item.cfop_interstate ?? '')
      })
      .catch((err) => {
        if (cancelled) return
        setLoadError(err instanceof ApiError ? err.message : 'Não foi possível carregar a natureza de operação.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [natureOperationId, session.token.token, reloadKey])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (!description.trim() || !cfopState.trim() || !cfopInterstate.trim()) {
      setError('Preencha descrição, CFOP estadual e CFOP interestadual para continuar.')
      return
    }

    const payload = {
      company_id: company.id,
      description: description.trim(),
      finality,
      cfop_state: cfopState.trim(),
      cfop_interstate: cfopInterstate.trim(),
    }

    setSubmitting(true)
    try {
      if (natureOperationId) {
        await updateNfeNatureOperation(session.token.token, natureOperationId, payload)
      } else {
        await createNfeNatureOperation(session.token.token, payload)
      }
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar a natureza de operação.')
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
          Voltar para natureza de operação
        </button>
        <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Fiscal</p>
        <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">
          {natureOperationId ? 'Editar natureza de operação' : 'Nova natureza de operação'}
        </h1>
      </div>

      {loading ? (
        <div className="h-11 animate-pulse rounded-xl bg-[var(--surface)]" />
      ) : loadError ? (
        <div className="flex flex-col items-start gap-3 rounded-2xl bg-[var(--red-100)] p-5">
          <p className="text-[13.5px] font-medium text-[var(--red-500)]">{loadError}</p>
          <button
            type="button"
            onClick={() => setReloadKey((key) => key + 1)}
            className="rounded-xl bg-[var(--surface)] px-4 py-2 text-[13px] font-bold text-[var(--red-500)] hover:bg-white"
          >
            Tentar novamente
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="mb-4 text-[14px] font-bold text-[var(--ink)]">Dados da natureza de operação</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div className="sm:col-span-2 xl:col-span-3">
                <TextField
                  label="Descrição"
                  icon={<TagIcon className="h-4 w-4" />}
                  placeholder="Ex: Venda de mercadoria"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </div>
              <SelectField label="Finalidade" value={finality} onChange={(event) => setFinality(Number(event.target.value))}>
                {Object.entries(NFE_NATURE_OPERATION_FINALITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </SelectField>
              <TextField
                label="CFOP estadual"
                icon={<TagIcon className="h-4 w-4" />}
                placeholder="Ex: 5102"
                value={cfopState}
                onChange={(event) => setCfopState(event.target.value)}
              />
              <TextField
                label="CFOP interestadual"
                icon={<TagIcon className="h-4 w-4" />}
                placeholder="Ex: 6102"
                value={cfopInterstate}
                onChange={(event) => setCfopInterstate(event.target.value)}
              />
            </div>
          </div>

          {error && (
            <p className="rounded-xl bg-[var(--red-100)] px-4 py-3 text-[13.5px] font-medium text-[var(--red-500)]">
              {error}
            </p>
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
