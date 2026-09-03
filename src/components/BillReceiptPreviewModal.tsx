import { useEffect, useState } from 'react'
import { printBillReceipt, type BillRecord } from '../lib/bills'
import { ApiError } from '../lib/api'
import { CloseIcon, PrinterIcon } from './icons'
import type { AuthSession } from '../lib/auth'

interface BillReceiptPreviewModalProps {
  open: boolean
  session: AuthSession
  bill: BillRecord | null
  onClose: () => void
}

export function BillReceiptPreviewModal({ open, session, bill, onClose }: BillReceiptPreviewModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !bill) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setUrl(null)

    printBillReceipt(session.token.token, bill.id)
      .then((res) => {
        if (cancelled) return
        setUrl(res.url)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof ApiError ? err.message : 'Não foi possível gerar o recibo.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, bill, session.token.token])

  if (!open || !bill) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--surface)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--blue-100)] text-[var(--blue-700)]">
            <PrinterIcon className="h-4.5 w-4.5" />
          </span>
          <div>
            <h2 className="text-[15px] font-bold text-[var(--ink)]">Recibo</h2>
            <p className="text-[12.5px] text-[var(--ink-soft)]">{bill.name}</p>
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
            Gerando recibo…
          </div>
        ) : error ? (
          <div className="flex h-full items-center justify-center p-6 text-center text-[13.5px] font-medium text-[var(--red-500)]">
            {error}
          </div>
        ) : url ? (
          <iframe title="Recibo" src={url} className="h-full w-full border-0" />
        ) : null}
      </div>
    </div>
  )
}
