import { useEffect, useState, type FormEvent } from 'react'
import {
  createNfeNatureOperation,
  NFE_NATURE_OPERATION_FINALITY_LABELS,
  type NfeNatureOperationRecord,
} from '../lib/nfeNatureOperations'
import { ApiError } from '../lib/api'
import { TextField } from './form/TextField'
import { SelectField } from './form/SelectField'
import { CloseIcon, TagIcon } from './icons'
import type { AuthCompany, AuthSession } from '../lib/auth'

export interface QuickNatureOperationRequest {
  // Texto que a pessoa já tinha digitado na busca (vira a descrição).
  description: string
  onCreated: (item: NfeNatureOperationRecord) => void
}

interface QuickNatureOperationModalProps {
  request: QuickNatureOperationRequest | null
  session: AuthSession
  company: AuthCompany
  onClose: () => void
}

// Cadastro rápido de natureza de operação, aberto de dentro da emissão da NF-e.
export function QuickNatureOperationModal({ request, session, company, onClose }: QuickNatureOperationModalProps) {
  const [description, setDescription] = useState('')
  const [finality, setFinality] = useState(1)
  const [cfopState, setCfopState] = useState('5102')
  const [cfopInterstate, setCfopInterstate] = useState('6102')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!request) return
    setDescription(request.description)
    setFinality(1)
    setCfopState('5102')
    setCfopInterstate('6102')
    setError(null)
  }, [request])

  if (!request) return null

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!request) return
    setError(null)

    if (!description.trim() || !cfopState.trim() || !cfopInterstate.trim()) {
      setError('Preencha a descrição e os dois CFOPs.')
      return
    }

    setSaving(true)
    try {
      const created = await createNfeNatureOperation(session.token.token, {
        company_id: company.id,
        description: description.trim(),
        finality,
        cfop_state: cfopState.trim(),
        cfop_interstate: cfopInterstate.trim(),
      })
      request.onCreated(created)
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível cadastrar a natureza de operação.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(event) => event.stopPropagation()}
        className="max-h-[90svh] w-full max-w-[460px] overflow-y-auto rounded-2xl bg-[var(--surface)] p-6 shadow-[var(--card-shadow)]"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[15px] font-bold text-[var(--ink)]">Nova natureza de operação</h2>
            <p className="mt-1 text-[12.5px] text-[var(--ink-soft)]">
              O CFOP estadual vale para clientes do mesmo estado e o interestadual para os de outros estados.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--page)]"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 flex flex-col gap-4">
          <TextField
            label="Descrição"
            icon={<TagIcon className="h-4 w-4" />}
            placeholder="Ex: Venda de mercadoria"
            autoFocus
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
          <SelectField label="Finalidade" value={finality} onChange={(event) => setFinality(Number(event.target.value))}>
            {Object.entries(NFE_NATURE_OPERATION_FINALITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectField>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="CFOP estadual"
              icon={<TagIcon className="h-4 w-4" />}
              inputMode="numeric"
              maxLength={4}
              value={cfopState}
              onChange={(event) => setCfopState(event.target.value.replace(/\D/g, ''))}
            />
            <TextField
              label="CFOP interestadual"
              icon={<TagIcon className="h-4 w-4" />}
              inputMode="numeric"
              maxLength={4}
              value={cfopInterstate}
              onChange={(event) => setCfopInterstate(event.target.value.replace(/\D/g, ''))}
            />
          </div>
        </div>

        {error && <p className="mt-4 text-[13px] font-medium text-[var(--red-500)]">{error}</p>}

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-11 flex-1 rounded-xl border border-[var(--border)] text-[13px] font-bold text-[var(--ink-soft)]"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="h-11 flex-1 rounded-xl bg-[var(--blue-500)] text-[13px] font-bold text-white hover:bg-[var(--blue-700)] disabled:opacity-60"
          >
            {saving ? 'Salvando…' : 'Cadastrar e vincular'}
          </button>
        </div>
      </form>
    </div>
  )
}
