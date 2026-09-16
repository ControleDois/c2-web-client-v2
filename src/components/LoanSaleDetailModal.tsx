import { useEffect, useState } from 'react'
import { fetchSale, type SaleRecord } from '../lib/sales'
import { formatCurrency, formatDate } from '../lib/format'
import { ApiError } from '../lib/api'
import { MODALITY_LABELS, parseModalityFromNote, avatarColorFor, initialsFor } from '../lib/loanModalities'
import { CloseIcon, PencilIcon } from './icons'
import type { AuthSession } from '../lib/auth'

interface LoanSaleDetailModalProps {
  session: AuthSession
  saleId: string | null
  onClose: () => void
  onEdit: (saleId: string) => void
}

function billStatusInfo(status: number | undefined, dateDue: string | null | undefined) {
  if (Number(status) === 1) return { label: 'Pago', className: 'bg-[var(--green-100)] text-[var(--green-600)]' }
  if (dateDue && dateDue.slice(0, 10) < new Date().toISOString().slice(0, 10)) {
    return { label: 'Atrasado', className: 'bg-[var(--red-100)] text-[var(--red-500)]' }
  }
  return { label: 'Em dia', className: 'bg-[var(--page)] text-[var(--ink-soft)]' }
}

export function LoanSaleDetailModal({ session, saleId, onClose, onEdit }: LoanSaleDetailModalProps) {
  const [sale, setSale] = useState<SaleRecord | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!saleId) {
      setSale(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)

    fetchSale(session.token.token, saleId)
      .then((data) => {
        if (!cancelled) setSale(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Não foi possível carregar a venda.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [saleId, session.token.token])

  if (!saleId) return null

  const { modality, cleanNote } = parseModalityFromNote(sale?.note)
  const bills = (sale?.bills || [])
    .slice()
    .sort((a, b) => (a.installment_number ?? 0) - (b.installment_number ?? 0))
  const paidCount = bills.filter((b) => Number(b.status) === 1).length
  const totalPaid = bills.filter((b) => Number(b.status) === 1).reduce((acc, b) => acc + Number(b.amount || 0), 0)
  const progress = bills.length > 0 ? Math.round((paidCount / bills.length) * 100) : 0
  const principal = Number(sale?.amount || 0)
  const total = Number(sale?.net_total || 0)
  const clientName = sale?.people?.name || ''

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-[560px] flex-col overflow-hidden rounded-2xl bg-[var(--surface)] shadow-[var(--card-shadow)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-[var(--border)] px-6 py-5">
          <div className="flex items-center gap-3">
            {clientName && (
              <span
                className="flex h-11 w-11 flex-none items-center justify-center rounded-full text-[14px] font-bold text-white"
                style={{ backgroundColor: avatarColorFor(clientName) }}
              >
                {initialsFor(clientName)}
              </span>
            )}
            <div>
              <h2 className="text-[16px] font-bold text-[var(--ink)]">{clientName || 'Detalhes da venda'}</h2>
              <p className="mt-0.5 text-[12px] text-[var(--ink-soft)]">{MODALITY_LABELS[modality]}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {sale && (
              <button
                type="button"
                onClick={() => onEdit(sale.id)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--ink-soft)] hover:bg-[var(--page)] hover:text-[var(--ink)]"
                title="Editar"
              >
                <PencilIcon className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--ink-soft)] hover:bg-[var(--page)] hover:text-[var(--ink)]"
              aria-label="Fechar"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="flex flex-col gap-2.5">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-10 animate-pulse rounded-xl bg-[var(--page)]" />
              ))}
            </div>
          ) : error ? (
            <p className="rounded-xl bg-[var(--red-100)] px-3.5 py-2.5 text-[13px] font-medium text-[var(--red-500)]">
              {error}
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">Emprestado</p>
                  <p className="mt-0.5 text-[15px] font-bold text-[var(--ink)]">{formatCurrency(principal)}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">Total</p>
                  <p className="mt-0.5 text-[15px] font-bold text-[var(--ink)]">{formatCurrency(total)}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">Valor pago</p>
                  <p className="mt-0.5 text-[15px] font-bold text-[var(--green-600)]">{formatCurrency(totalPaid)}</p>
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between text-[11px] text-[var(--muted)]">
                  <span>
                    {paidCount} de {bills.length} parcelas pagas
                  </span>
                  <span>{progress}%</span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--border)]">
                  <div className="h-full bg-[var(--blue-500)]" style={{ width: `${progress}%` }} />
                </div>
              </div>

              {cleanNote && (
                <div className="mt-4 rounded-xl bg-[var(--page)] px-3.5 py-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">Observação</p>
                  <p className="mt-0.5 text-[13px] text-[var(--ink)]">{cleanNote}</p>
                </div>
              )}

              <div className="mt-5 overflow-hidden rounded-xl border border-[var(--border)]">
                <table className="w-full border-collapse text-[12.5px]">
                  <thead className="bg-[var(--page)]">
                    <tr className="text-left text-[10.5px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                      <th className="py-2 pl-3.5 pr-2">Nº</th>
                      <th className="px-2 py-2">Vencimento</th>
                      <th className="px-2 py-2 text-right">Valor</th>
                      <th className="px-2 py-2 pr-3.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bills.map((bill) => {
                      const info = billStatusInfo(bill.status, bill.date_due)
                      return (
                        <tr key={bill.id} className="border-t border-[var(--border)]">
                          <td className="py-2 pl-3.5 pr-2 font-semibold text-[var(--ink)]">
                            {bill.installment_number}
                          </td>
                          <td className="px-2 py-2 text-[var(--ink-soft)]">{formatDate(bill.date_due)}</td>
                          <td className="px-2 py-2 text-right font-semibold text-[var(--ink)]">
                            {formatCurrency(Number(bill.amount || 0))}
                          </td>
                          <td className="px-2 py-2 pr-3.5 text-right">
                            <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${info.className}`}>
                              {info.label}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
