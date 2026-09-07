import { useState } from 'react'
import { ungroupBill, type BillRecord } from '../lib/bills'
import { formatCurrency } from '../lib/format'
import { ApiError } from '../lib/api'
import { CloseIcon, LinkIcon, XCircleIcon } from './icons'
import type { AuthSession } from '../lib/auth'

interface GroupDetailsModalProps {
  open: boolean
  session: AuthSession
  bill: BillRecord | null
  onClose: () => void
  onUngrouped: () => void
}

export function GroupDetailsModal({ open, session, bill, onClose, onUngrouped }: GroupDetailsModalProps) {
  const [ungrouping, setUngrouping] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open || !bill) return null

  const groupeds = bill.groupeds ?? []

  async function handleUngroup() {
    if (!bill) return
    setUngrouping(true)
    setError(null)
    try {
      await ungroupBill(session.token.token, bill.id)
      onUngrouped()
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível desagrupar as contas.')
    } finally {
      setUngrouping(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={ungrouping ? undefined : onClose}>
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
              <h2 className="text-[15px] font-bold text-[var(--ink)]">{bill.name}</h2>
              <p className="text-[12.5px] text-[var(--ink-soft)]">
                {groupeds.length} conta{groupeds.length === 1 ? '' : 's'} agrupada{groupeds.length === 1 ? '' : 's'} ·{' '}
                {formatCurrency(bill.amount)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={ungrouping}
            className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--page)] hover:text-[var(--ink)] disabled:opacity-60"
            aria-label="Fechar"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          {groupeds.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-[var(--muted)]">Nenhuma conta encontrada no agrupamento.</p>
          ) : (
            groupeds.map((grouped) => (
              <div
                key={grouped.id}
                className="flex items-center justify-between rounded-xl bg-[var(--page)] px-3.5 py-2.5"
              >
                <span className="text-[13px] font-semibold text-[var(--ink)]">{grouped.name}</span>
                <span className="font-mono text-[12.5px] font-semibold text-[var(--ink-soft)]">
                  {formatCurrency(grouped.amount)}
                </span>
              </div>
            ))
          )}
        </div>

        {error && <p className="mt-3 text-[13px] font-medium text-[var(--red-500)]">{error}</p>}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={ungrouping}
            className="rounded-xl px-4 py-2 text-[13.5px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)] disabled:opacity-60"
          >
            Fechar
          </button>
          {bill.status === 0 && (
            <button
              type="button"
              onClick={handleUngroup}
              disabled={ungrouping}
              className="flex items-center gap-2 rounded-xl bg-[var(--red-100)] px-4 py-2 text-[13.5px] font-bold text-[var(--red-500)] transition hover:bg-[var(--red-500)] hover:text-white disabled:opacity-60"
            >
              <XCircleIcon className="h-4 w-4" />
              {ungrouping ? 'Desagrupando…' : 'Desagrupar'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
