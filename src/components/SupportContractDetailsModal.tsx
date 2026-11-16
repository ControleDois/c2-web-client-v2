import { useEffect, useState } from 'react'
import { ApiError } from '../lib/api'
import type { AuthSession } from '../lib/auth'
import { billStatusLabel, FORM_PAYMENT_LABELS } from '../lib/bills'
import { formatCurrency, formatDate } from '../lib/format'
import { contractStage, fetchSupportContract, type SupportContractRecord } from '../lib/supportContracts'
import { CloseIcon } from './icons'

const STAGE_LABEL = {
  all: 'Todos',
  not_sent: 'A enviar',
  pending_signature: 'Aguardando assinatura',
  signed: 'Assinado',
  canceled: 'Cancelado',
} as const

interface Props {
  session: AuthSession
  contract: SupportContractRecord | null
  onClose: () => void
}

// Detalhes do contrato de suporte com todas as mensalidades vinculadas (só leitura).
export function SupportContractDetailsModal({ session, contract, onClose }: Props) {
  const [full, setFull] = useState<SupportContractRecord | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!contract) return
    let cancelled = false
    setFull(null)
    setError(null)
    fetchSupportContract(session.token.token, contract.id)
      .then((data) => !cancelled && setFull(data))
      .catch((err) => !cancelled && setError(err instanceof ApiError ? err.message : 'Não foi possível carregar o contrato.'))
    return () => {
      cancelled = true
    }
  }, [contract, session.token.token])

  useEffect(() => {
    if (!contract) return
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [contract, onClose])

  if (!contract) return null

  const bills = [...(full?.bills ?? [])].sort((a, b) => (a.installment_number ?? 0) - (b.installment_number ?? 0) || a.date_due.localeCompare(b.date_due))
  const today = new Date().toISOString().slice(0, 10)
  const totals = bills.reduce(
    (acc, bill) => {
      acc.total += Number(bill.amount || 0)
      if (bill.status === 1) acc.received += Number(bill.bill_value ?? bill.amount ?? 0)
      else if (bill.status === 0) {
        acc.open += Number(bill.amount || 0)
        if (bill.date_due.slice(0, 10) < today) acc.overdue += Number(bill.amount || 0)
      }
      return acc
    },
    { total: 0, received: 0, open: 0, overdue: 0 }
  )
  const stage = contractStage(contract)

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:py-10" onClick={onClose}>
      <div className="w-full max-w-[760px] rounded-2xl bg-[var(--surface)] shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] p-5">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Contrato {contract.code ? `#${contract.code}` : ''}</p>
            <h2 className="truncate text-[18px] font-bold text-[var(--ink)]">{contract.people?.name ?? '—'}</h2>
            <p className="text-[13px] text-[var(--ink-soft)]">{contract.title}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--page)]">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 border-b border-[var(--border)] p-5 sm:grid-cols-4">
          <Info label="Situação" value={STAGE_LABEL[stage]} />
          <Info label="Valor mensal" value={formatCurrency(Number(contract.monthly_value))} />
          <Info label="Vencimento" value={`Dia ${contract.billing_day}`} />
          <Info label="Início" value={formatDate(contract.start_date)} />
          <Info label="Pagamento" value={FORM_PAYMENT_LABELS[contract.form_payment] ?? '—'} />
          <Info label="Responsável" value={full?.user?.name ?? contract.user?.name ?? '—'} />
          {contract.notes && (
            <div className="col-span-2">
              <Info label="Observações" value={contract.notes} />
            </div>
          )}
        </div>

        <div className="p-5">
          <div className="mb-3 flex items-baseline justify-between">
            <h3 className="text-[14px] font-bold text-[var(--ink)]">Mensalidades vinculadas</h3>
            <span className="text-[12px] text-[var(--muted)]">{bills.length} parcela(s)</span>
          </div>
          {error ? (
            <p className="rounded-xl bg-[var(--red-100)] px-4 py-3 text-[13px] font-medium text-[var(--red-500)]">{error}</p>
          ) : !full ? (
            <div className="flex flex-col gap-2">
              {[0, 1, 2].map((index) => (
                <div key={index} className="h-9 animate-pulse rounded-lg bg-[var(--page)]" />
              ))}
            </div>
          ) : bills.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-[var(--muted)]">Nenhuma mensalidade lançada para este contrato.</p>
          ) : (
            <div className="max-h-[420px] overflow-auto rounded-xl border border-[var(--border)]">
              <table className="w-full text-[13px]">
                <thead className="sticky top-0 bg-[var(--page)] text-left text-[11.5px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                  <tr>
                    <th className="px-3 py-2">Parcela</th>
                    <th className="px-3 py-2">Vencimento</th>
                    <th className="px-3 py-2 text-right">Valor</th>
                    <th className="px-3 py-2">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {bills.map((bill) => {
                    const overdue = bill.status === 0 && bill.date_due.slice(0, 10) < today
                    const tone =
                      bill.status === 1
                        ? 'bg-[var(--green-100)] text-[var(--green-600)]'
                        : overdue
                          ? 'bg-[var(--red-100)] text-[var(--red-500)]'
                          : bill.status === 0
                            ? 'bg-[var(--amber-100)] text-[var(--amber-500)]'
                            : 'bg-[var(--page)] text-[var(--ink-soft)]'
                    return (
                      <tr key={bill.id}>
                        <td className="px-3 py-2 font-semibold text-[var(--ink)]">
                          {bill.installment_number ?? '—'}/{bill.installments ?? bills.length}
                        </td>
                        <td className="px-3 py-2 text-[var(--ink-soft)]">{formatDate(bill.date_due)}</td>
                        <td className="px-3 py-2 text-right font-semibold text-[var(--ink)]">{formatCurrency(Number(bill.amount))}</td>
                        <td className="px-3 py-2">
                          <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-bold ${tone}`}>
                            {overdue ? 'Em atraso' : billStatusLabel(bill.status, 1)}
                          </span>
                          {bill.status === 1 && bill.date_received && (
                            <span className="ml-2 text-[11.5px] text-[var(--muted)]">em {formatDate(bill.date_received)}</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot className="sticky bottom-0 border-t-2 border-[var(--border)] bg-[var(--page)]">
                  <tr>
                    <td colSpan={2} className="px-3 py-2.5 font-bold text-[var(--ink)]">
                      Total
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-[var(--ink)]">{formatCurrency(totals.total)}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px]">
                        <span className="font-semibold text-[var(--green-600)]">Recebido {formatCurrency(totals.received)}</span>
                        <span className="font-semibold text-[var(--amber-500)]">A receber {formatCurrency(totals.open)}</span>
                        {totals.overdue > 0 && <span className="font-semibold text-[var(--red-500)]">Em atraso {formatCurrency(totals.overdue)}</span>}
                      </div>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11.5px] font-semibold text-[var(--muted)]">{label}</p>
      <p className="truncate text-[13.5px] font-semibold text-[var(--ink)]">{value}</p>
    </div>
  )
}
