import { useEffect, useState } from 'react'
import { fetchSupportContractSendTimeline, type SendTimeline, type SendTimelineEvent } from '../lib/supportContracts'
import { fetchLoanSendTimeline } from '../lib/sales'
import { ApiError } from '../lib/api'
import { CheckCircleIcon, CloseIcon } from './icons'
import type { AuthSession } from '../lib/auth'

interface SupportContractTimelineModalProps {
  open: boolean
  session: AuthSession
  contract: { id: string; people?: { name?: string | null } | null } | null
  flow?: 'support' | 'loan'
  onClose: () => void
}

function formatMoment(value?: string | null) {
  if (!value) return null
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'America/Cuiaba',
  }).format(new Date(value))
}

function formatShort(value?: string | null) {
  if (!value) return null
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Cuiaba',
  }).format(new Date(value))
}

const TONE_DOT: Record<SendTimelineEvent['tone'], string> = {
  ok: 'bg-[var(--green-600)]',
  error: 'bg-[var(--red-500)]',
  info: 'bg-[var(--muted)]',
}

export function SupportContractTimelineModal({
  open,
  session,
  contract,
  flow = 'support',
  onClose,
}: SupportContractTimelineModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [timeline, setTimeline] = useState<SendTimeline | null>(null)

  useEffect(() => {
    if (!open || !contract) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setTimeline(null)

    const fetchTimeline = flow === 'loan' ? fetchLoanSendTimeline : fetchSupportContractSendTimeline
    fetchTimeline(session.token.token, contract.id)
      .then((res) => {
        if (!cancelled) setTimeline(res)
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof ApiError ? err.message : 'Não foi possível carregar os detalhes do envio.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, contract, flow, session.token.token])

  if (!open || !contract) return null

  const isNative = timeline?.signature?.provider === 'nativo'
  const summary = timeline?.summary
  const milestones = summary
    ? [
        { key: 'sent', label: 'Enviado', at: summary.sentAt },
        { key: 'delivered', label: 'Entregue', at: summary.deliveredAt },
        { key: 'read', label: 'Lido', at: summary.readAt },
        ...(isNative ? [{ key: 'opened', label: 'Abriu o link', at: summary.openedAt }] : []),
        { key: 'signed', label: 'Assinado', at: summary.signedAt },
      ]
    : []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90svh] w-full max-w-[560px] overflow-y-auto rounded-2xl bg-[var(--surface)] p-6 shadow-[var(--card-shadow)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[15px] font-bold text-[var(--ink)]">Detalhes do envio</h2>
            <p className="mt-1 text-[12.5px] text-[var(--ink-soft)]">
              {contract.people?.name ?? (flow === 'loan' ? 'Contrato de empréstimo' : 'Contrato de suporte')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--page)] hover:text-[var(--ink)]"
            aria-label="Fechar"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <p className="py-10 text-center text-[13px] text-[var(--muted)]">Carregando…</p>
        ) : error ? (
          <p className="py-10 text-center text-[13px] font-medium text-[var(--red-500)]">{error}</p>
        ) : !timeline?.signature ? (
          <p className="py-10 text-center text-[13px] text-[var(--muted)]">Este contrato ainda não foi enviado.</p>
        ) : (
          <div className="mt-5 flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {milestones.map((item) => (
                <div
                  key={item.key}
                  className={`rounded-xl px-3 py-2.5 ${item.at ? 'bg-[var(--green-100)]' : 'bg-[var(--page)]'}`}
                >
                  <p
                    className={`flex items-center gap-1 text-[11.5px] font-bold ${
                      item.at ? 'text-[var(--green-600)]' : 'text-[var(--muted)]'
                    }`}
                  >
                    {item.at && <CheckCircleIcon className="h-3.5 w-3.5" />}
                    {item.label}
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-[var(--ink-soft)]">{formatShort(item.at) ?? 'Aguardando'}</p>
                </div>
              ))}
            </div>

            <ol className="relative flex flex-col gap-4 border-l border-[var(--border)] pl-5">
              {timeline.events.map((event, index) => (
                <li key={`${event.kind}-${event.at}-${index}`} className="relative">
                  <span
                    className={`absolute top-1.5 -left-[25px] h-2.5 w-2.5 rounded-full ring-4 ring-[var(--surface)] ${TONE_DOT[event.tone]}`}
                  />
                  <p
                    className={`text-[13px] font-semibold ${
                      event.tone === 'error' ? 'text-[var(--red-500)]' : 'text-[var(--ink)]'
                    }`}
                  >
                    {event.title}
                  </p>
                  {event.detail && (
                    <p className="mt-0.5 text-[12px] break-words text-[var(--ink-soft)]">{event.detail}</p>
                  )}
                  <p className="mt-0.5 text-[11.5px] text-[var(--muted)]">{formatMoment(event.at)} (Cuiabá)</p>
                </li>
              ))}
            </ol>

            <p className="rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[11.5px] text-[var(--ink-soft)]">
              “Entregue” e “Lido” vêm do WhatsApp. Se o cliente desativou a confirmação de leitura, a mensagem pode ter
              sido lida sem aparecer aqui.
              {isNative
                ? ' “Abriu o link” e a leitura do documento são registrados pelo nosso sistema, independente do WhatsApp.'
                : ' Neste contrato não há como saber se o cliente abriu o link, só o resultado final da assinatura.'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
