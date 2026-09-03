import { useEffect, useState, type FormEvent } from 'react'
import { createRentalType, fetchRentalType, updateRentalType, type RentalTypeRecord } from '../lib/rentalTypes'
import { fetchContractTemplates, type ContractTemplateRecord } from '../lib/contractTemplates'
import { ApiError } from '../lib/api'
import { TextField } from '../components/form/TextField'
import { SelectField } from '../components/form/SelectField'
import { TargetIcon, ChevronLeftIcon } from '../components/icons'
import type { AuthSession, AuthCompany } from '../lib/auth'

interface RentalTypeFormPageProps {
  session: AuthSession
  company: AuthCompany
  rentalTypeId?: string
  onBack: () => void
  onSaved: () => void
}

export function RentalTypeFormPage({ session, company, rentalTypeId, onBack, onSaved }: RentalTypeFormPageProps) {
  const [loading, setLoading] = useState(Boolean(rentalTypeId))
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [name, setName] = useState('')
  const [contractTemplateId, setContractTemplateId] = useState('')
  const [templates, setTemplates] = useState<ContractTemplateRecord[]>([])

  useEffect(() => {
    fetchContractTemplates(session.token.token, company.id, { limit: 200 })
      .then((res) => setTemplates(res.data || []))
      .catch(() => setTemplates([]))
  }, [session.token.token, company.id])

  useEffect(() => {
    if (!rentalTypeId) return
    let cancelled = false
    setLoading(true)
    setLoadError(null)

    fetchRentalType(session.token.token, rentalTypeId)
      .then((item: RentalTypeRecord) => {
        if (cancelled) return
        setName(item.name ?? '')
        setContractTemplateId(item.contract_template_id ?? '')
      })
      .catch((err) => {
        if (cancelled) return
        setLoadError(err instanceof ApiError ? err.message : 'Não foi possível carregar o tipo de aluguel.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [rentalTypeId, session.token.token, reloadKey])

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
      contract_template_id: contractTemplateId || undefined,
    }

    setSubmitting(true)
    try {
      if (rentalTypeId) {
        await updateRentalType(session.token.token, rentalTypeId, payload)
      } else {
        await createRentalType(session.token.token, payload)
      }
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar o tipo de aluguel.')
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
          Voltar para tipos de aluguel
        </button>
        <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Aluguel de veículos</p>
        <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">
          {rentalTypeId ? 'Editar tipo de aluguel' : 'Novo tipo de aluguel'}
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
            <h2 className="mb-1 text-[14px] font-bold text-[var(--ink)]">Dados do tipo de aluguel</h2>
            <p className="mb-4 text-[12px] text-[var(--muted)]">
              O modelo de contrato vinculado é usado automaticamente ao gerar/enviar o contrato de um aluguel desse
              tipo, no lugar do padrão da empresa.
            </p>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <TextField
                label="Nome"
                icon={<TargetIcon className="h-4 w-4" />}
                placeholder="Ex: Frota, Curta duração, Longa duração"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              <SelectField
                label="Modelo de contrato"
                value={contractTemplateId}
                onChange={(event) => setContractTemplateId(event.target.value)}
              >
                <option value="">Padrão da empresa</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.title}
                  </option>
                ))}
              </SelectField>
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
