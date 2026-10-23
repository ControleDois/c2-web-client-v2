import { useEffect, useState } from 'react'
import { fetchRentalDetails, type BillTimelineItem, type RentalDetails } from '../lib/bills'
import { formatCurrency, formatDate, formatDateTime } from '../lib/format'
import { ApiError } from '../lib/api'
import { CloseIcon } from './icons'
import { BillDetailsModal } from './BillDetailsModal'
import type { AuthSession } from '../lib/auth'

interface RentalDetailsModalProps {
  open: boolean
  session: AuthSession
  saleId: string | null
  onClose: () => void
}

const STATUS_LABELS: Record<number, string> = { 0: 'Pendente (aguardando retirada)', 1: 'Retirado', 2: 'Devolvido' }
const FREQUENCY_LABELS: Record<string, string> = { daily: 'Diária', weekly: 'Semanal', monthly: 'Mensal' }
const CHARGE_LABELS: Record<string, { label: string; tone: string }> = {
  queued: { label: 'Na fila', tone: 'bg-[var(--page)] text-[var(--ink-soft)]' },
  sent: { label: 'Enviada', tone: 'bg-[var(--blue-100)] text-[var(--blue-700)]' },
  delivered: { label: 'Entregue', tone: 'bg-[var(--blue-100)] text-[var(--blue-700)]' },
  read: { label: 'Lida', tone: 'bg-[var(--green-100)] text-[var(--green-600)]' },
  failed: { label: 'Falhou', tone: 'bg-[var(--red-100)] text-[var(--red-500)]' },
}
const KIND_DOT: Record<BillTimelineItem['kind'], string> = {
  created: 'bg-[var(--blue-500)]',
  edited: 'bg-[var(--muted)]',
  paid: 'bg-[var(--green-600)]',
  reopened: 'bg-[var(--amber-500)]',
  charge: 'bg-[var(--blue-500)]',
  document: 'bg-[var(--blue-700)]',
  deleted: 'bg-[var(--red-500)]',
  error: 'bg-[var(--red-500)]',
  other: 'bg-[var(--amber-500)]',
}
const TIMELINE_PAGE = 40

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-[13px]">
      <span className="flex-none text-[var(--muted)]">{label}</span>
      <span className="text-right font-medium text-[var(--ink)]">{children}</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--border)] p-4">
      <h3 className="mb-1.5 text-[12px] font-bold tracking-wide text-[var(--muted)] uppercase">{title}</h3>
      {children}
    </section>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl bg-[var(--page)] px-3 py-2.5 text-center">
      <p className="text-[11px] font-semibold text-[var(--muted)]">{label}</p>
      <p className={`mt-0.5 text-[14px] font-bold ${tone ?? 'text-[var(--ink)]'}`}>{value}</p>
    </div>
  )
}

export function RentalDetailsModal({ open, session, saleId, onClose }: RentalDetailsModalProps) {
  const [data, setData] = useState<RentalDetails | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [billId, setBillId] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [onlyDeleted, setOnlyDeleted] = useState(false)

  useEffect(() => {
    if (!open || !saleId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setData(null)
    setShowAll(false)
    setOnlyDeleted(false)
    fetchRentalDetails(session.token.token, saleId)
      .then((res) => {
        if (!cancelled) setData(res)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Não foi possível carregar os detalhes do aluguel.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, saleId, session.token.token])

  if (!open) return null

  const contract = data?.contract
  const totals = data?.totals
  const bills = data ? (onlyDeleted ? data.bills.filter((bill) => bill.deleted) : data.bills) : []
  const timeline = data ? (showAll ? data.timeline : data.timeline.slice(0, TIMELINE_PAGE)) : []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[94vh] w-full max-w-[860px] flex-col rounded-2xl bg-[var(--surface)] shadow-[var(--card-shadow)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] p-5">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Detalhes do aluguel</p>
            <h2 className="mt-0.5 truncate text-[17px] font-bold text-[var(--ink)]">
              {data ? `Aluguel #${data.sale.code}${contract?.vehicle ? ` · ${contract.vehicle}` : ''}` : 'Carregando…'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--page)] hover:text-[var(--ink)]"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
          {loading && (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-20 animate-pulse rounded-2xl bg-[var(--page)]" />
              ))}
            </div>
          )}
          {error && <p className="text-[13px] font-medium text-[var(--red-500)]">{error}</p>}

          {data && totals && (
            <>
              {data.sale.deleted && (
                <p className="rounded-xl bg-[var(--red-100)] px-4 py-2.5 text-[13px] font-semibold text-[var(--red-500)]">
                  Este aluguel foi excluído.
                </p>
              )}

              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <Stat label={`Contas (${totals.bills})`} value={formatCurrency(totals.bills_total)} />
                <Stat label={`Recebido (${totals.received_count})`} value={formatCurrency(totals.received_total)} tone="text-[var(--green-600)]" />
                <Stat label={`Em aberto (${totals.open_count})`} value={formatCurrency(totals.open_total)} tone="text-[var(--blue-700)]" />
                <Stat label={`Excluídas (${totals.deleted_count})`} value={formatCurrency(totals.deleted_total)} tone="text-[var(--red-500)]" />
              </div>

              {contract && (
                <Section title="Contrato">
                  <Row label="Situação">{STATUS_LABELS[contract.status] ?? '—'}</Row>
                  <Row label="Veículo">{contract.vehicle ?? '—'}</Row>
                  <Row label="Locatário">{contract.renter ?? '—'}</Row>
                  {contract.driver && contract.driver !== contract.renter && <Row label="Motorista">{contract.driver}</Row>}
                  {contract.owner && <Row label="Proprietário">{contract.owner}</Row>}
                  {contract.rental_type && <Row label="Tipo de locação">{contract.rental_type}</Row>}
                  <Row label="Período">
                    {formatDate(contract.start_date)} a {formatDate(contract.end_date)}
                  </Row>
                  <Row label="Cobrança">
                    {FREQUENCY_LABELS[contract.frequency ?? ''] ?? contract.frequency ?? '—'} · {formatCurrency(contract.monthly_value)}
                  </Row>
                  {contract.security_deposit > 0 && <Row label="Caução">{formatCurrency(contract.security_deposit)}</Row>}
                  <Row label="Retirada">{contract.pickup_date ? formatDate(contract.pickup_date) : 'Ainda não registrada'}</Row>
                  <Row label="Devolução">{contract.return_date ? formatDate(contract.return_date) : 'Ainda não registrada'}</Row>
                  <Row label="Criado por">
                    {data.sale.created_by ?? 'Não identificado'} · {formatDateTime(data.sale.created_at)}
                  </Row>
                  {contract.notes && <Row label="Observações">{contract.notes}</Row>}
                </Section>
              )}

              <Section title={`Contas do aluguel (${data.bills.length})`}>
                {totals.deleted_count > 0 && (
                  <label className="mb-2 flex items-center gap-2 text-[12.5px] font-semibold text-[var(--ink-soft)]">
                    <input
                      type="checkbox"
                      checked={onlyDeleted}
                      onChange={(event) => setOnlyDeleted(event.target.checked)}
                      className="h-4 w-4 accent-[var(--blue-500)]"
                    />
                    Mostrar só as contas excluídas ({totals.deleted_count})
                  </label>
                )}
                <div className="max-h-[320px] overflow-auto rounded-xl border border-[var(--border)]">
                  <table className="w-full border-collapse text-[12.5px]">
                    <thead>
                      <tr className="border-b border-[var(--border)] text-left text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                        <th className="px-3 py-2">Conta</th>
                        <th className="py-2 pr-3">Vencimento</th>
                        <th className="py-2 pr-3 text-right">Valor</th>
                        <th className="py-2 pr-3">Situação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bills.map((bill) => (
                        <tr
                          key={bill.id}
                          onClick={() => setBillId(bill.id)}
                          className={`cursor-pointer border-b border-[var(--border)] last:border-none hover:bg-[var(--page)] ${bill.deleted ? 'bg-[var(--red-100)]/40' : ''}`}
                        >
                          <td className={`px-3 py-2 font-medium ${bill.deleted ? 'text-[var(--muted)] line-through' : 'text-[var(--ink)]'}`}>{bill.name}</td>
                          <td className="py-2 pr-3 text-[var(--ink-soft)]">{formatDate(bill.date_due)}</td>
                          <td className="py-2 pr-3 text-right text-[var(--ink-soft)]">{formatCurrency(bill.amount)}</td>
                          <td className="py-2 pr-3">
                            {bill.deleted ? (
                              <span className="font-semibold text-[var(--red-500)]">
                                Excluída em {formatDateTime(bill.deleted_at)}
                                {bill.deleted_by ? ` por ${bill.deleted_by}` : ''}
                              </span>
                            ) : bill.status === 1 ? (
                              <span className="font-semibold text-[var(--green-600)]">
                                Recebida {formatDate(bill.date_received)}
                                {bill.paid_via === 'automatic' ? ' (automática)' : bill.paid_by ? ` por ${bill.paid_by}` : ''}
                              </span>
                            ) : bill.status === 2 ? (
                              <span className="text-[var(--ink-soft)]">Baixada em lote</span>
                            ) : (
                              <span className="text-[var(--blue-700)]">Em aberto</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-1.5 text-[11.5px] text-[var(--muted)]">Clique numa conta para ver os detalhes dela.</p>
              </Section>

              {data.signatures.length > 0 && (
                <Section title="Assinatura do contrato">
                  {data.signatures.map((signature) => (
                    <Row key={signature.id} label={signature.signer_name ?? 'Assinante'}>
                      {signature.signed_at
                        ? `Assinado em ${formatDateTime(signature.signed_at)}`
                        : signature.error
                          ? `Erro: ${signature.error}`
                          : `Enviado em ${formatDateTime(signature.sent_at)} · aguardando assinatura`}
                    </Row>
                  ))}
                </Section>
              )}

              <Section title={`Mensagens enviadas (${data.charges.length})`}>
                {data.charges.length === 0 ? (
                  <p className="py-1 text-[13px] text-[var(--muted)]">Nenhuma mensagem foi enviada para este aluguel.</p>
                ) : (
                  <div className="flex max-h-[260px] flex-col gap-2 overflow-y-auto">
                    {data.charges.map((charge) => {
                      const meta = CHARGE_LABELS[charge.status]
                      return (
                        <div key={charge.id} className="rounded-xl bg-[var(--page)] p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${meta.tone}`}>{meta.label}</span>
                            <span className="text-[12px] font-semibold text-[var(--ink-soft)]">
                              {charge.subject} · {charge.automated ? 'automática' : 'manual'}
                              {charge.whatsapp_name ? ` · ${charge.whatsapp_name}` : ''}
                            </span>
                            <span className="ml-auto text-[12px] text-[var(--muted)]">{formatDateTime(charge.at)}</span>
                          </div>
                          {charge.last_error && <p className="mt-1 text-[12px] font-medium text-[var(--red-500)]">{charge.last_error}</p>}
                        </div>
                      )
                    })}
                  </div>
                )}
              </Section>

              <Section title={`Histórico completo (${data.timeline.length})`}>
                <ol className="flex flex-col">
                  {timeline.map((item, index) => (
                    <li key={`${item.at}-${index}`} className="relative flex gap-3 pb-3 last:pb-0">
                      <span className="mt-1.5 flex flex-none flex-col items-center">
                        <span className={`h-2.5 w-2.5 rounded-full ${KIND_DOT[item.kind]}`} />
                        {index < timeline.length - 1 && <span className="mt-1 w-px flex-1 bg-[var(--border)]" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-[var(--ink)]">{item.title}</p>
                        <p className="text-[12px] text-[var(--muted)]">
                          {formatDateTime(item.at)} · {item.by ?? (item.automatic ? 'Automático' : 'Usuário não identificado')}
                        </p>
                        {item.detail && <p className="mt-0.5 text-[12px] whitespace-pre-line text-[var(--ink-soft)]">{item.detail}</p>}
                      </div>
                    </li>
                  ))}
                </ol>
                {!showAll && data.timeline.length > TIMELINE_PAGE && (
                  <button
                    type="button"
                    onClick={() => setShowAll(true)}
                    className="mt-3 rounded-xl border border-[var(--border)] px-4 py-2 text-[12.5px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]"
                  >
                    Mostrar tudo ({data.timeline.length - TIMELINE_PAGE} a mais)
                  </button>
                )}
              </Section>
            </>
          )}
        </div>
      </div>
      <div onClick={(event) => event.stopPropagation()}>
        <BillDetailsModal open={Boolean(billId)} session={session} billId={billId} role={1} onClose={() => setBillId(null)} />
      </div>
    </div>
  )
}
