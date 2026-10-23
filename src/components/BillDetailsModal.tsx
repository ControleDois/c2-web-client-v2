import { useEffect, useState } from 'react'
import { fetchBillDetails, type BillDetails, type BillTimelineItem } from '../lib/bills'
import { formatCurrency, formatDate, formatDateTime } from '../lib/format'
import { ApiError } from '../lib/api'
import { CloseIcon } from './icons'
import type { AuthSession } from '../lib/auth'

interface BillDetailsModalProps {
  open: boolean
  session: AuthSession
  billId: string | null
  role: 0 | 1
  onClose: () => void
}

const FORM_PAYMENT_LABELS: Record<number, string> = {
  0: 'Boleto bancário',
  1: 'Cartão de crédito',
  2: 'Cartão de débito',
  3: 'Carteira digital',
  4: 'Cashback',
  5: 'Cheque',
  6: 'Crédito da loja',
  7: 'Crédito virtual',
  8: 'Depósito bancário',
  9: 'Dinheiro',
  10: 'PIX',
  11: 'Programa de fidelidade',
  12: 'Transferência bancária',
  13: 'Vale alimentação',
  14: 'Vale combustível',
  15: 'Vale presente',
  16: 'Vale refeição',
}

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
  other: 'bg-[var(--muted)]',
}

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

export function BillDetailsModal({ open, session, billId, role, onClose }: BillDetailsModalProps) {
  const [data, setData] = useState<BillDetails | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !billId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setData(null)
    fetchBillDetails(session.token.token, billId)
      .then((res) => {
        if (!cancelled) setData(res)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Não foi possível carregar os detalhes.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, billId, session.token.token])

  if (!open) return null

  const paidWord = role === 1 ? 'recebida' : 'paga'
  const bill = data?.bill
  const settlement = data?.settlement

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-[720px] flex-col rounded-2xl bg-[var(--surface)] shadow-[var(--card-shadow)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] p-5">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">
              Detalhes da conta {role === 1 ? 'a receber' : 'a pagar'}
            </p>
            <h2 className="mt-0.5 truncate text-[17px] font-bold text-[var(--ink)]">{bill?.name ?? 'Carregando…'}</h2>
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

          {data && bill && (
            <>
              <Section title="Resumo">
                <Row label="Situação">
                  {bill.status === 1 ? `Conta ${paidWord}` : bill.status === 2 ? 'Baixada em lote (agrupada)' : 'Em aberto'}
                </Row>
                <Row label="Valor">{formatCurrency(bill.amount)}</Row>
                <Row label="Vencimento">{formatDate(bill.date_due)}</Row>
                {bill.people_name && <Row label={role === 1 ? 'Cliente' : 'Fornecedor'}>{bill.people_name}</Row>}
                {bill.category_name && <Row label="Categoria">{bill.category_name}</Row>}
                {bill.bank_name && <Row label="Conta bancária">{bill.bank_name}</Row>}
                <Row label="Forma de pagamento">{FORM_PAYMENT_LABELS[bill.form_payment] ?? '—'}</Row>
                {bill.installments && bill.installments > 1 && (
                  <Row label="Parcela">
                    {bill.installment_number}/{bill.installments}
                  </Row>
                )}
                <Row label="Origem">{data.origin.label}</Row>
                {(bill.has_pix || bill.has_boleto) && (
                  <Row label="Cobrança gerada">
                    {[bill.has_pix ? 'PIX' : null, bill.has_boleto ? `Boleto${bill.boleto_provider ? ` (${bill.boleto_provider})` : ''}` : null]
                      .filter(Boolean)
                      .join(' e ')}
                  </Row>
                )}
                {bill.note && <Row label="Observação">{bill.note.trim()}</Row>}
              </Section>

              <Section title="Quem criou">
                <Row label="Criada em">{formatDateTime(data.created.at)}</Row>
                <Row label="Criada por">
                  {data.created.by ??
                    (data.origin.type === 'license'
                      ? 'Gerada pelo sistema'
                      : 'Não identificado (registro anterior ao controle de auditoria)')}
                </Row>
              </Section>

              <Section title={role === 1 ? 'Recebimento' : 'Pagamento'}>
                {settlement ? (
                  <>
                    <Row label="Data">{formatDate(settlement.date_received)}</Row>
                    <Row label={role === 1 ? 'Valor recebido' : 'Valor pago'}>{formatCurrency(settlement.amount)}</Row>
                    {settlement.fees > 0 && <Row label="Juros e multa">{formatCurrency(settlement.fees)}</Row>}
                    {settlement.discount > 0 && <Row label="Desconto">{formatCurrency(settlement.discount)}</Row>}
                    <Row label="Baixa feita por">
                      {settlement.via === 'user' && (settlement.by ?? 'Usuário do sistema')}
                      {settlement.via === 'automatic' && (
                        <span className="rounded-full bg-[var(--blue-100)] px-2.5 py-0.5 text-[12px] font-bold text-[var(--blue-700)]">
                          Automática{settlement.detail ? ` · ${settlement.detail}` : ''}
                        </span>
                      )}
                      {settlement.via === 'import' && `Lançada por importação${settlement.detail ? ` (${settlement.detail})` : ''}`}
                      {settlement.via === 'unknown' && 'Não identificado (anterior ao controle de auditoria)'}
                    </Row>
                    {settlement.grouped && <Row label="Observação">Baixada em lote junto com outras contas</Row>}
                  </>
                ) : (
                  <p className="py-1 text-[13px] text-[var(--muted)]">Esta conta ainda está em aberto.</p>
                )}
              </Section>

              <Section title={`Cobranças enviadas (${data.charges.length})`}>
                {data.charges.length === 0 ? (
                  <p className="py-1 text-[13px] text-[var(--muted)]">Nenhuma mensagem de cobrança foi enviada para esta conta.</p>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {data.charges.map((charge) => {
                      const meta = CHARGE_LABELS[charge.status]
                      return (
                        <div key={charge.id} className="rounded-xl bg-[var(--page)] p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${meta.tone}`}>{meta.label}</span>
                            <span className="text-[12px] font-semibold text-[var(--ink-soft)]">
                              {charge.automated ? 'Automática' : 'Manual'}
                              {charge.ai_generated ? ' · texto por IA' : ''}
                              {charge.whatsapp_name ? ` · ${charge.whatsapp_name}` : ''}
                            </span>
                            <span className="ml-auto text-[12px] text-[var(--muted)]">
                              {formatDateTime(charge.sent_at ?? charge.scheduled_at)}
                            </span>
                          </div>
                          {charge.text && <p className="mt-1.5 text-[12.5px] whitespace-pre-line text-[var(--ink-soft)]">{charge.text}</p>}
                          {charge.last_error && <p className="mt-1 text-[12px] font-medium text-[var(--red-500)]">{charge.last_error}</p>}
                        </div>
                      )
                    })}
                  </div>
                )}
              </Section>

              <Section title="Histórico">
                <ol className="flex flex-col">
                  {data.timeline.map((item, index) => (
                    <li key={`${item.at}-${index}`} className="relative flex gap-3 pb-3 last:pb-0">
                      <span className="mt-1.5 flex flex-none flex-col items-center">
                        <span className={`h-2.5 w-2.5 rounded-full ${KIND_DOT[item.kind]}`} />
                        {index < data.timeline.length - 1 && <span className="mt-1 w-px flex-1 bg-[var(--border)]" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-[var(--ink)]">{item.title}</p>
                        <p className="text-[12px] text-[var(--muted)]">
                          {formatDateTime(item.at)} · {item.by ?? (item.automatic ? 'Automático' : 'Usuário não identificado')}
                        </p>
                        {item.detail && <p className="mt-0.5 text-[12px] text-[var(--ink-soft)]">{item.detail}</p>}
                      </div>
                    </li>
                  ))}
                </ol>
              </Section>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
