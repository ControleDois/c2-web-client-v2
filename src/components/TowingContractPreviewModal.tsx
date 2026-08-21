import { useEffect, useState } from 'react'
import { printTowingSaleContract, type TowingSaleRecord } from '../lib/towingSale'
import { ApiError } from '../lib/api'
import { CloseIcon, PrinterIcon } from './icons'
import type { AuthSession } from '../lib/auth'

interface TowingContractPreviewModalProps {
  open: boolean
  session: AuthSession
  sale: TowingSaleRecord | null
  onClose: () => void
}

export function TowingContractPreviewModal({ open, session, sale, onClose }: TowingContractPreviewModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !sale) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setUrl(null)

    printTowingSaleContract(session.token.token, sale.id)
      .then((res) => {
        if (cancelled) return
        setUrl(res.url)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof ApiError ? err.message : 'Não foi possível gerar a pré-visualização do contrato.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, sale, session.token.token])

  if (!open || !sale) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--surface)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--blue-100)] text-[var(--blue-700)]">
            <PrinterIcon className="h-4.5 w-4.5" />
          </span>
          <div>
            <h2 className="text-[15px] font-bold text-[var(--ink)]">Contrato</h2>
            <p className="text-[12.5px] text-[var(--ink-soft)]">Venda de guincho #{sale.code}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl bg-[var(--page)] px-3.5 py-2 text-[12.5px] font-bold text-[var(--blue-700)] hover:bg-[var(--blue-100)]"
            >
              Abrir em nova aba
            </a>
          )}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--page)] hover:text-[var(--ink)]"
            aria-label="Fechar"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden bg-[var(--page)]">
        {loading ? (
          <div className="flex h-full items-center justify-center text-[13.5px] text-[var(--muted)]">
            Gerando pré-visualização…
          </div>
        ) : error ? (
          <div className="flex h-full items-center justify-center p-6 text-center text-[13.5px] font-medium text-[var(--red-500)]">
            {error}
          </div>
        ) : url ? (
          <iframe title="Pré-visualização do contrato" src={url} className="h-full w-full border-0" />
        ) : null}
      </div>
    </div>
  )
}
