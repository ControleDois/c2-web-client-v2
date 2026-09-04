import { useEffect, useState } from 'react'
import {
  fetchPurchaseRequests,
  PURCHASE_REQUEST_STATUS_LABELS,
  type PurchaseRequestRecord,
} from '../lib/purchaseManagement'
import { formatCurrency, formatDateTime } from '../lib/format'
import { ApiError } from '../lib/api'
import { ChevronDownIcon } from '../components/icons'
import type { AuthSession, AuthCompany } from '../lib/auth'

interface PurchaseRequestsPageProps {
  session: AuthSession
  company: AuthCompany
  onBack: () => void
}

const PAGE_SIZE = 10

function statusTone(status: number): string {
  return status === 1 ? 'bg-[var(--green-100)] text-[var(--green-600)]' : 'bg-[var(--amber-100)] text-[var(--amber-500)]'
}

export function PurchaseRequestsPage({ session, company, onBack }: PurchaseRequestsPageProps) {
  const [requests, setRequests] = useState<PurchaseRequestRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchPurchaseRequests(session.token.token, company.id, { page, limit: PAGE_SIZE })
      .then((res) => {
        if (cancelled) return
        setRequests(res.data)
        setLastPage(res.meta?.last_page ?? 1)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof ApiError ? err.message : 'Não foi possível carregar as solicitações de compra.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [session.token.token, company.id, page])

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Operação</p>
          <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">Histórico de Compras</h1>
          <p className="mt-1 text-[13px] text-[var(--muted)]">Solicitações de compra já enviadas.</p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl px-4 py-2.5 text-[13px] font-semibold text-[var(--muted)] hover:text-[var(--ink)]"
        >
          Voltar
        </button>
      </div>

      {error && (
        <div className="rounded-2xl bg-[var(--red-100)] p-4 text-[13.5px] font-medium text-[var(--red-500)]">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        {loading ? (
          <div className="flex flex-col gap-2.5">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-11 animate-pulse rounded-xl bg-[var(--page)]" />
            ))}
          </div>
        ) : requests.length === 0 ? (
          <p className="py-10 text-center text-[13.5px] text-[var(--muted)]">Nenhuma solicitação de compra ainda.</p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {requests.map((req) => {
              const expanded = expandedId === req.id
              return (
                <div key={req.id} className="rounded-xl border border-[var(--border)]">
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : req.id)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <span className="rounded-lg bg-[var(--blue-100)] px-2 py-1 text-[11px] font-bold text-[var(--blue-700)]">
                        #{req.code}
                      </span>
                      <div>
                        <p className="text-[13px] font-semibold text-[var(--ink)]">{formatDateTime(req.created_at)}</p>
                        <p className="text-[11.5px] text-[var(--muted)]">
                          {req.requested_by_user?.people?.name || req.requested_by_user?.email || 'Usuário não identificado'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusTone(req.status)}`}>
                        {PURCHASE_REQUEST_STATUS_LABELS[req.status] ?? req.status}
                      </span>
                      <span className="text-[13.5px] font-bold text-[var(--green-600)]">
                        {formatCurrency(req.total_amount)}
                      </span>
                      <ChevronDownIcon
                        className={`h-4 w-4 text-[var(--muted)] transition-transform ${expanded ? 'rotate-180' : ''}`}
                      />
                    </div>
                  </button>

                  {expanded && (
                    <div className="border-t border-[var(--border)] px-4 py-3">
                      {req.items && req.items.length > 0 ? (
                        <table className="w-full text-[12.5px]">
                          <thead>
                            <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                              <th className="pb-1.5">Produto</th>
                              <th className="pb-1.5 text-right">Qtd.</th>
                              <th className="pb-1.5 text-right">Preço unit.</th>
                              <th className="pb-1.5 text-right">Subtotal</th>
                            </tr>
                          </thead>
                          <tbody>
                            {req.items.map((item) => (
                              <tr key={item.id} className="border-t border-[var(--border)]">
                                <td className="py-1.5">{item.product?.name ?? '—'}</td>
                                <td className="py-1.5 text-right">{item.quantity}</td>
                                <td className="py-1.5 text-right">{formatCurrency(item.unit_price)}</td>
                                <td className="py-1.5 text-right font-semibold">{formatCurrency(item.subtotal)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="text-[12.5px] text-[var(--muted)]">Sem itens.</p>
                      )}
                      {req.notes && <p className="mt-2 text-[12px] text-[var(--muted)]">Obs: {req.notes}</p>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {!loading && lastPage > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-[12px] text-[var(--muted)]">Página {page} de {lastPage}</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--ink-soft)] disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={page >= lastPage}
                onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--ink-soft)] disabled:opacity-40"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
