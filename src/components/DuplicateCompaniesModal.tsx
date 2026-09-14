import { useEffect, useState } from 'react'
import { fetchDuplicateCompanies, type DuplicateCompanyGroup } from '../lib/licenses'
import { formatDocument } from '../lib/formatDocument'
import { ApiError } from '../lib/api'
import { CloseIcon, AlertTriangleIcon } from './icons'
import type { AuthSession } from '../lib/auth'

interface DuplicateCompaniesModalProps {
  open: boolean
  session: AuthSession
  onClose: () => void
}

export function DuplicateCompaniesModal({ open, session, onClose }: DuplicateCompaniesModalProps) {
  const [groups, setGroups] = useState<DuplicateCompanyGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setError(null)
    fetchDuplicateCompanies(session.token.token)
      .then(setGroups)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Não foi possível checar os CNPJs.'))
      .finally(() => setLoading(false))
  }, [open, session.token.token])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-[520px] rounded-2xl bg-[var(--surface)] p-6 shadow-[var(--card-shadow)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--red-100)] text-[var(--red-500)]">
              <AlertTriangleIcon className="h-4.5 w-4.5" />
            </span>
            <div>
              <h2 className="text-[15px] font-bold text-[var(--ink)]">CNPJs duplicados</h2>
              <p className="text-[12.5px] text-[var(--ink-soft)]">Cadastros de empresa com o mesmo documento</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--page)] hover:text-[var(--ink)]"
            aria-label="Fechar"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex max-h-[50vh] flex-col gap-3 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-14 animate-pulse rounded-xl bg-[var(--page)]" />
              ))}
            </div>
          ) : error ? (
            <p className="py-6 text-center text-[13px] font-medium text-[var(--red-500)]">{error}</p>
          ) : groups.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-[var(--muted)]">Nenhum CNPJ duplicado encontrado.</p>
          ) : (
            groups.map((group) => (
              <div key={group.document} className="rounded-xl bg-[var(--page)] p-3">
                <p className="font-mono text-[12.5px] font-bold text-[var(--ink)]">
                  {formatDocument(group.document)}
                </p>
                <div className="mt-1.5 flex flex-col gap-1">
                  {group.items.map((item) => (
                    <p key={item.id} className="text-[12.5px] text-[var(--ink-soft)]">
                      {item.name}
                    </p>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-6 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-[13.5px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
