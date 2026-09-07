import { useCallback, useEffect, useState } from 'react'
import { groupBillsSelected, type BillRecord } from '../lib/bills'
import { fetchPeople, type PersonRecord } from '../lib/people'
import { formatDocument } from '../lib/formatDocument'
import { formatCurrency } from '../lib/format'
import { ApiError } from '../lib/api'
import { CloseIcon, LinkIcon, TagIcon } from './icons'
import { TextField } from './form/TextField'
import { SearchSelectField } from './form/SearchSelectField'
import type { AuthSession, AuthCompany } from '../lib/auth'

interface GroupBillsModalProps {
  open: boolean
  session: AuthSession
  company: AuthCompany
  bills: BillRecord[]
  onClose: () => void
  onSuccess: () => void
}

export function GroupBillsModal({ open, session, company, bills, onClose, onSuccess }: GroupBillsModalProps) {
  const [name, setName] = useState('')
  const [person, setPerson] = useState<{ id: string; label: string; sub?: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const total = bills.reduce((sum, bill) => sum + Number(bill.amount || 0), 0)
  const notPending = bills.some((bill) => bill.status !== 0)

  useEffect(() => {
    if (!open) return
    setName(`AGRUPAMENTO - ${bills.length} CONTAS`)
    setPerson(null)
    setError(null)
  }, [open, bills])

  const searchPeople = useCallback(
    (query: string) => fetchPeople(session.token.token, company.id, { search: query, limit: 8 }).then((res) => res.data),
    [session.token.token, company.id]
  )

  if (!open) return null

  async function handleSubmit() {
    setError(null)
    if (bills.length < 2) {
      setError('Selecione pelo menos duas contas para agrupar.')
      return
    }
    if (notPending) {
      setError('Só é possível agrupar contas pendentes.')
      return
    }
    if (!person) {
      setError('Selecione a pessoa responsável pelo agrupamento.')
      return
    }

    setSubmitting(true)
    try {
      await groupBillsSelected(session.token.token, {
        ids: bills.map((bill) => bill.id),
        name: name.trim() || undefined,
        people_id: person.id,
      })
      onSuccess()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível agrupar as contas selecionadas.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={submitting ? undefined : onClose}>
      <div
        className="w-full max-w-[480px] rounded-2xl bg-[var(--surface)] p-6 shadow-[var(--card-shadow)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--blue-100)] text-[var(--blue-700)]">
              <LinkIcon className="h-4.5 w-4.5" />
            </span>
            <div>
              <h2 className="text-[15px] font-bold text-[var(--ink)]">Agrupar contas</h2>
              <p className="text-[12.5px] text-[var(--ink-soft)]">
                {bills.length} conta{bills.length === 1 ? '' : 's'} · {formatCurrency(total)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--page)] hover:text-[var(--ink)] disabled:opacity-60"
            aria-label="Fechar"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        {notPending && (
          <p className="mt-4 rounded-xl bg-[var(--red-100)] px-4 py-3 text-[13px] font-semibold text-[var(--red-500)]">
            Uma ou mais contas selecionadas não estão pendentes. Só é possível agrupar contas pendentes.
          </p>
        )}

        <div className="mt-4 flex flex-col gap-4">
          <TextField
            label="Nome do agrupamento"
            icon={<TagIcon className="h-4 w-4" />}
            placeholder="AGRUPAMENTO - N CONTAS"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <SearchSelectField
            label="Pessoa responsável"
            placeholder="Buscar por nome ou documento"
            selectedLabel={person?.label ?? null}
            selectedSubLabel={person?.sub ? formatDocument(person.sub) : undefined}
            onSearch={searchPeople}
            getOptionLabel={(item: PersonRecord) => item.name}
            getOptionSubLabel={(item: PersonRecord) => (item.document ? formatDocument(item.document) : undefined)}
            onSelect={(item: PersonRecord) => setPerson({ id: item.id, label: item.name, sub: item.document ?? undefined })}
            onClear={() => setPerson(null)}
          />
        </div>

        {error && <p className="mt-3 text-[13px] font-medium text-[var(--red-500)]">{error}</p>}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl px-4 py-2 text-[13.5px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)] disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || notPending}
            className="rounded-xl bg-[var(--blue-500)] px-5 py-2.5 text-[13.5px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:opacity-60"
          >
            {submitting ? 'Agrupando…' : 'Agrupar'}
          </button>
        </div>
      </div>
    </div>
  )
}
