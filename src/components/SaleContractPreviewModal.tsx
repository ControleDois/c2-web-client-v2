import { useEffect, useState } from 'react'
import { printSaleContract, type SaleRecord } from '../lib/sales'
import { ApiError } from '../lib/api'
import { CloseIcon, PrinterIcon, CheckCircleIcon } from './icons'
import type { AuthSession } from '../lib/auth'

interface SaleContractPreviewModalProps {
  open: boolean
  session: AuthSession
  sale: SaleRecord | null
  onClose: () => void
}

export function SaleContractPreviewModal({ open, session, sale, onClose }: SaleContractPreviewModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [signed, setSigned] = useState(false)

  useEffect(() => {
    if (!open || !sale) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setUrl(null)
    setSigned(false)

    printSaleContract(session.token.token, sale.id)
      .then((res) => {
        if (cancelled) return
        setUrl(res.url)
        setSigned(Boolean(res.signed))
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
          <span
            className={`flex h-9 w-9 items-center justify-center rounded-full ${
              signed ? 'bg-[var(--green-100)] text-[var(--green-600)]' : 'bg-[var(--blue-100)] text-[var(--blue-700)]'
            }`}
          >
            {signed ? <CheckCircleIcon className="h-4.5 w-4.5" /> : <PrinterIcon className="h-4.5 w-4.5" />}
          </span>
          <div>
            <h2 className="text-[15px] font-bold text-[var(--ink)]">{signed ? 'Contrato assinado' : 'Contrato'}</h2>
            <p className="text-[12.5px] text-[var(--ink-soft)]">#{sale.internal_code ?? sale.code}</p>
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
              {signed ? 'Abrir contrato assinado' : 'Abrir em nova aba'}
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
        ) : signed && url ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--green-100)] text-[var(--green-600)]">
              <CheckCircleIcon className="h-7 w-7" />
            </span>
            <div>
              <p className="text-[14px] font-bold text-[var(--ink)]">Este contrato já foi assinado pelo locatário</p>
              <p className="mt-1 text-[12.5px] text-[var(--ink-soft)]">
                O documento assinado fica hospedado no Autentique — abra em uma nova aba para conferir ou baixar o PDF.
              </p>
            </div>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl bg-[var(--blue-500)] px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-[var(--blue-700)]"
            >
              Abrir contrato assinado
            </a>
          </div>
        ) : url ? (
          <iframe title="Pré-visualização do contrato" src={url} className="h-full w-full border-0" />
        ) : null}
      </div>
    </div>
  )
}
