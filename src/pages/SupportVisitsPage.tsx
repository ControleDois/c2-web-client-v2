import { useEffect, useState } from 'react'
import {
  fetchSupportVisits,
  fetchSupportVisit,
  VISIT_TYPE_LABELS,
  VISIT_STATUS_LABELS,
  type SupportVisitRecord,
} from '../lib/supportVisits'
import { ApiError } from '../lib/api'
import { formatDateTime } from '../lib/format'
import { SearchIcon, PlusIcon, EyeIcon, CloseIcon, ClipboardCheckIcon } from '../components/icons'
import { Select } from '../components/form/Select'
import type { AuthSession, AuthCompany } from '../lib/auth'

interface SupportVisitsPageProps {
  session: AuthSession
  company: AuthCompany
  onCreate: () => void
}

function statusTone(status: number) {
  return status === 1 ? 'bg-[var(--green-100)] text-[var(--green-600)]' : 'bg-[var(--blue-100)] text-[var(--blue-700)]'
}

export function SupportVisitsPage({ session, company, onCreate }: SupportVisitsPageProps) {
  const token = session.token.token
  const [search, setSearch] = useState('')
  const [visitType, setVisitType] = useState('')
  const [page, setPage] = useState(1)
  const [visits, setVisits] = useState<SupportVisitRecord[]>([])
  const [meta, setMeta] = useState({ total: 0, lastPage: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detailItem, setDetailItem] = useState<SupportVisitRecord | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  function load() {
    setLoading(true)
    setError(null)
    fetchSupportVisits(token, company.id, {
      search: search || undefined,
      visitType: visitType === '' ? undefined : Number(visitType),
      page,
      limit: 10,
    })
      .then((res) => {
        setVisits(res.data)
        setMeta({ total: res.meta?.total ?? res.data.length, lastPage: res.meta?.last_page ?? 1 })
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Não foi possível carregar as visitas.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [token, company.id, search, visitType, page])

  function openDetail(item: SupportVisitRecord) {
    setDetailItem(item)
    setLoadingDetail(true)
    fetchSupportVisit(token, item.id)
      .then((full) => setDetailItem(full))
      .catch(() => {})
      .finally(() => setLoadingDetail(false))
  }

  const photos = detailItem?.photos ?? []

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Suporte Técnico</p>
          <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">Visitas Técnicas</h1>
        </div>
        <button
          type="button"
          onClick={onCreate}
          className="flex items-center gap-2 rounded-xl bg-[var(--blue-500)] px-4 py-2.5 text-[13.5px] font-bold text-white transition hover:bg-[var(--blue-700)]"
        >
          <PlusIcon className="h-4 w-4" />
          Nova Visita
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5">
          <SearchIcon className="h-4 w-4 flex-none text-[var(--muted)]" />
          <input
            type="text"
            placeholder="Buscar por cliente"
            value={search}
            onChange={(event) => {
              setPage(1)
              setSearch(event.target.value)
            }}
            className="w-full bg-transparent text-[13.5px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none"
          />
        </div>
        <div className="w-full sm:w-56">
          <Select
            value={visitType}
            onChange={(value) => {
              setPage(1)
              setVisitType(value)
            }}
          >
            <option value="">Todos os tipos</option>
            {Object.entries(VISIT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl bg-[var(--red-100)] p-4 text-[13.5px] font-medium text-[var(--red-500)]">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        {loading ? (
          <div className="flex flex-col gap-2.5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-11 animate-pulse rounded-xl bg-[var(--page)]" />
            ))}
          </div>
        ) : visits.length === 0 ? (
          <p className="py-10 text-center text-[13.5px] text-[var(--muted)]">
            Nenhuma visita técnica encontrada{search ? ` para "${search}"` : ''}.
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-2.5 sm:hidden">
              {visits.map((visit) => (
                <button
                  key={visit.id}
                  type="button"
                  onClick={() => openDetail(visit)}
                  className="w-full rounded-xl border border-[var(--border)] p-3 text-left"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="min-w-0 truncate text-[13.5px] font-bold text-[var(--ink)]">
                        {visit.people?.name ?? '—'}
                      </p>
                      <p className="mt-0.5 text-[12px] text-[var(--muted)]">
                        {VISIT_TYPE_LABELS[visit.visit_type] ?? '—'} · {formatDateTime(visit.created_at)}
                      </p>
                    </div>
                    <span className={`flex-none rounded-full px-2.5 py-1 text-[10.5px] font-bold ${statusTone(visit.status)}`}>
                      {VISIT_STATUS_LABELS[visit.status] ?? '—'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                    <th className="pb-2.5 pl-3">Código</th>
                    <th className="pb-2.5">Cliente</th>
                    <th className="pb-2.5">Tipo</th>
                    <th className="pb-2.5">Data</th>
                    <th className="pb-2.5">Status</th>
                    <th className="pb-2.5 pr-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {visits.map((visit, index) => (
                    <tr
                      key={visit.id}
                      onClick={() => openDetail(visit)}
                      className={`cursor-pointer border-b border-[var(--border)] transition-colors last:border-none hover:bg-[var(--blue-100)] ${
                        index % 2 === 1 ? 'bg-[var(--page)]' : ''
                      }`}
                    >
                      <td className="py-2.5 pl-3 font-mono text-[var(--ink-soft)]">{visit.code ? `#${visit.code}` : '—'}</td>
                      <td className="py-2.5 font-medium text-[var(--ink)]">{visit.people?.name ?? '—'}</td>
                      <td className="py-2.5 text-[var(--ink-soft)]">{VISIT_TYPE_LABELS[visit.visit_type] ?? '—'}</td>
                      <td className="py-2.5 whitespace-nowrap text-[var(--ink-soft)]">{formatDateTime(visit.created_at)}</td>
                      <td className="py-2.5">
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusTone(visit.status)}`}>
                          {VISIT_STATUS_LABELS[visit.status] ?? '—'}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-right" onClick={(event) => event.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => openDetail(visit)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--page)] hover:text-[var(--ink)]"
                          aria-label="Ver detalhes"
                        >
                          <EyeIcon className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {!loading && meta.lastPage > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-[12px] text-[var(--muted)]">{meta.total} visitas no total</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--ink-soft)] disabled:opacity-40"
              >
                Anterior
              </button>
              <span className="text-[12.5px] text-[var(--ink-soft)]">
                {page} / {meta.lastPage}
              </span>
              <button
                type="button"
                disabled={page >= meta.lastPage}
                onClick={() => setPage((p) => Math.min(meta.lastPage, p + 1))}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--ink-soft)] disabled:opacity-40"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>

      {detailItem && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[var(--surface)]">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--blue-100)] text-[var(--blue-700)]">
                <ClipboardCheckIcon className="h-4.5 w-4.5" />
              </span>
              <div>
                <h2 className="text-[15px] font-bold text-[var(--ink)]">
                  Visita {detailItem.code ? `#${detailItem.code}` : ''}
                </h2>
                <p className="text-[12px] text-[var(--muted)]">{formatDateTime(detailItem.created_at)}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDetailItem(null)}
              className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--page)] hover:text-[var(--ink)]"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="mx-auto flex w-full min-h-0 max-w-[900px] flex-1 flex-col overflow-y-auto px-4 py-6 sm:px-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">Cliente</p>
                <p className="mt-0.5 text-[13.5px] font-medium text-[var(--ink)]">{detailItem.people?.name || '—'}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">Tipo</p>
                <p className="mt-0.5 text-[13.5px] font-medium text-[var(--ink)]">
                  {VISIT_TYPE_LABELS[detailItem.visit_type] ?? '—'}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">Técnico</p>
                <p className="mt-0.5 text-[13.5px] font-medium text-[var(--ink)]">
                  {detailItem.technician_signer_name || detailItem.user?.name || '—'}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">Status</p>
                <span className={`mt-1 inline-block rounded-full px-2.5 py-1 text-[11px] font-bold ${statusTone(detailItem.status)}`}>
                  {VISIT_STATUS_LABELS[detailItem.status] ?? '—'}
                </span>
              </div>
            </div>

            {detailItem.description && (
              <div className="mt-6">
                <p className="text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">O que foi feito</p>
                <p className="mt-1 whitespace-pre-line text-[13.5px] text-[var(--ink)]">{detailItem.description}</p>
              </div>
            )}

            <div className="mt-6">
              <p className="text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                Fotos ({loadingDetail ? '…' : photos.length})
              </p>
              {photos.length > 0 ? (
                <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {photos.map((photo) => (
                    <div key={photo.id} className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--page)]">
                      <img src={photo.file_url} alt={photo.name || ''} className="h-32 w-full object-cover" />
                      {photo.name && (
                        <p className="truncate px-2 py-1.5 text-[11.5px] font-medium text-[var(--ink-soft)]">{photo.name}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                !loadingDetail && <p className="mt-2 text-[13px] text-[var(--muted)]">Nenhuma foto registrada.</p>
              )}
            </div>

            {(detailItem.technician_signature_url || detailItem.customer_signature_url) && (
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {detailItem.technician_signature_url && (
                  <div>
                    <p className="text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                      Assinatura {detailItem.technician_signer_name ? `de ${detailItem.technician_signer_name}` : 'do técnico'}
                    </p>
                    <img
                      src={detailItem.technician_signature_url}
                      alt="Assinatura do técnico"
                      className="mt-1 h-16 rounded-lg border border-[var(--border)] bg-white object-contain p-1"
                    />
                  </div>
                )}
                {detailItem.customer_signature_url && (
                  <div>
                    <p className="text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                      Assinatura {detailItem.customer_signer_name ? `de ${detailItem.customer_signer_name}` : 'do cliente'}
                    </p>
                    <img
                      src={detailItem.customer_signature_url}
                      alt="Assinatura do cliente"
                      className="mt-1 h-16 rounded-lg border border-[var(--border)] bg-white object-contain p-1"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
