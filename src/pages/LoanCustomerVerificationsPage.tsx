import { useEffect, useRef, useState } from 'react'
import {
  fetchLoanCustomerVerifications,
  reviewLoanCustomerVerification,
  type LoanCustomerVerificationRecord,
  type LoanCustomerVerificationStatus,
  type PeopleDocumentRef,
} from '../lib/loanCustomerVerifications'
import { ApiError } from '../lib/api'
import { formatDateTime } from '../lib/format'
import { formatPhone } from '../lib/formatPhone'
import { isImageUrl, isPdfUrl } from '../lib/download'
import { SearchIcon, ChevronDownIcon, CloseIcon, BadgeIcon, CheckCircleIcon, XCircleIcon, FileTextIcon } from '../components/icons'
import { DocumentViewerModal, type DocumentViewerItem } from '../components/DocumentViewerModal'
import type { AuthSession, AuthCompany } from '../lib/auth'

interface LoanCustomerVerificationsPageProps {
  session: AuthSession
  company: AuthCompany
}

const STATUS_LABELS: Record<LoanCustomerVerificationStatus, string> = {
  pending_documents: 'Aguardando documentos',
  pending_review: 'Em análise',
  approved: 'Aprovado',
  rejected: 'Reprovado',
}

const STATUS_FILTERS: { value: LoanCustomerVerificationStatus | ''; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'pending_documents', label: STATUS_LABELS.pending_documents },
  { value: 'pending_review', label: STATUS_LABELS.pending_review },
  { value: 'approved', label: STATUS_LABELS.approved },
  { value: 'rejected', label: STATUS_LABELS.rejected },
]

function statusBadgeClass(status: LoanCustomerVerificationStatus) {
  if (status === 'approved') return 'bg-[var(--green-100)] text-[var(--green-600)]'
  if (status === 'rejected') return 'bg-[var(--red-100)] text-[var(--red-500)]'
  return 'bg-[var(--amber-100)] text-[var(--amber-500)]'
}

function buildDocuments(item: LoanCustomerVerificationRecord): DocumentViewerItem[] {
  const identityLabel = item.documentType === 'cnh' ? 'CNH' : 'RG'
  const entries: { key: string; title: string; doc?: PeopleDocumentRef | null }[] = [
    { key: 'address', title: 'Comprovante de endereço', doc: item.addressProofDocument },
    { key: 'front', title: `${identityLabel} (frente)`, doc: item.identityDocument },
    { key: 'back', title: `${identityLabel} (verso)`, doc: item.identityDocumentBack },
    { key: 'selfie', title: 'Selfie', doc: item.selfieDocument },
    { key: 'employment', title: 'Comprovante de trabalho', doc: item.employmentProofDocument },
    { key: 'rental', title: 'Contrato de aluguel', doc: item.rentalContractDocument },
  ]

  return entries
    .filter((entry) => entry.doc?.file_url)
    .map((entry) => ({
      title: entry.title,
      description: entry.doc?.file_name,
      url: entry.doc!.file_url!,
      fileName: entry.doc?.file_name,
    }))
}

function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function LoanCustomerVerificationsPage({ session, company }: LoanCustomerVerificationsPageProps) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<LoanCustomerVerificationStatus | ''>('')
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<LoanCustomerVerificationRecord[]>([])
  const [meta, setMeta] = useState({ total: 0, lastPage: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const [detailItem, setDetailItem] = useState<LoanCustomerVerificationRecord | null>(null)
  const [reviewing, setReviewing] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [rejectNotes, setRejectNotes] = useState('')
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const skipDebounce = useRef(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const timeout = setTimeout(
      () => {
        fetchLoanCustomerVerifications(session.token.token, company.id, { search, status, page, limit: 10 })
          .then((res) => {
            if (cancelled) return
            setItems(res.data || [])
            setMeta({ total: res.meta?.total ?? res.data?.length ?? 0, lastPage: res.meta?.last_page ?? 1 })
          })
          .catch((err) => {
            if (cancelled) return
            setError(err instanceof ApiError ? err.message : 'Não foi possível carregar as verificações.')
          })
          .finally(() => {
            if (!cancelled) setLoading(false)
          })
      },
      skipDebounce.current ? 0 : 350,
    )
    skipDebounce.current = false

    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status, page, company.id, session.token.token, refreshKey])

  function reload() {
    skipDebounce.current = true
    setRefreshKey((key) => key + 1)
  }

  async function handleReview(nextStatus: 'approved' | 'rejected', notes?: string) {
    if (!detailItem) return
    setReviewing(true)
    setActionError(null)
    try {
      const updated = await reviewLoanCustomerVerification(session.token.token, company.id, detailItem.id, {
        status: nextStatus,
        notes,
      })
      setDetailItem(updated)
      setShowRejectForm(false)
      setRejectNotes('')
      reload()
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Não foi possível atualizar a verificação.')
    } finally {
      setReviewing(false)
    }
  }

  const documents = detailItem ? buildDocuments(detailItem) : []
  const canReview = detailItem ? detailItem.status !== 'pending_documents' : false

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div>
        <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Empréstimo</p>
        <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">Verificações de Cadastro</h1>
        <p className="mt-1 text-[13px] text-[var(--muted)]">
          Revise os documentos enviados pelos clientes e aprove ou reprove o cadastro.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5">
          <SearchIcon className="h-4 w-4 flex-none text-[var(--muted)]" />
          <input
            type="text"
            placeholder="Buscar por nome ou CPF/CNPJ"
            value={search}
            onChange={(event) => {
              setPage(1)
              setSearch(event.target.value)
            }}
            className="w-full bg-transparent text-[13.5px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none"
          />
        </div>

        <div className="relative flex w-full items-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 sm:w-56">
          <select
            value={status}
            onChange={(event) => {
              setPage(1)
              setStatus(event.target.value as LoanCustomerVerificationStatus | '')
            }}
            className="w-full appearance-none bg-transparent text-[13.5px] font-semibold text-[var(--ink-soft)] focus:outline-none"
          >
            {STATUS_FILTERS.map((option) => (
              <option key={option.label} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDownIcon className="pointer-events-none h-3.5 w-3.5 flex-none text-[var(--muted)]" />
        </div>
      </div>

      {error && (
        <div className="rounded-2xl bg-[var(--red-100)] p-4 text-[13.5px] font-medium text-[var(--red-500)]">{error}</div>
      )}

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        {loading ? (
          <div className="flex flex-col gap-2.5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-11 animate-pulse rounded-xl bg-[var(--page)]" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="py-10 text-center text-[13.5px] text-[var(--muted)]">
            Nenhuma verificação encontrada{search ? ` para "${search}"` : ''}.
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-2.5 sm:hidden">
              {items.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setDetailItem(item)}
                  className="cursor-pointer rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="min-w-0 truncate text-[13.5px] font-bold text-[var(--ink)]">
                        {item.people?.name || '—'}
                      </p>
                      <p className="mt-0.5 text-[12px] text-[var(--muted)]">{item.people?.document || '—'}</p>
                      <p className="text-[12px] text-[var(--ink-soft)]">{formatDateTime(item.createdAt)}</p>
                    </div>
                    <span className={`flex-none rounded-full px-2.5 py-1 text-[10.5px] font-bold ${statusBadgeClass(item.status)}`}>
                      {STATUS_LABELS[item.status]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                    <th className="pb-2.5 pl-3">Cliente</th>
                    <th className="pb-2.5">CPF/CNPJ</th>
                    <th className="pb-2.5">Telefone</th>
                    <th className="pb-2.5">Data</th>
                    <th className="pb-2.5 pr-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr
                      key={item.id}
                      onClick={() => setDetailItem(item)}
                      className={`cursor-pointer border-b border-[var(--border)] transition-colors last:border-none hover:bg-[var(--blue-100)] ${
                        index % 2 === 1 ? 'bg-[var(--page)]' : ''
                      }`}
                    >
                      <td className="py-2.5 pl-3 font-medium text-[var(--ink)]">{item.people?.name || '—'}</td>
                      <td className="py-2.5 text-[var(--ink-soft)]">{item.people?.document || '—'}</td>
                      <td className="py-2.5 text-[var(--ink-soft)]">
                        {item.people?.phone ? formatPhone(item.people.phone) : '—'}
                      </td>
                      <td className="py-2.5 whitespace-nowrap text-[var(--ink-soft)]">{formatDateTime(item.createdAt)}</td>
                      <td className="py-2.5 pr-3">
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusBadgeClass(item.status)}`}>
                          {STATUS_LABELS[item.status]}
                        </span>
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
            <p className="text-[12px] text-[var(--muted)]">{meta.total} verificações no total</p>
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
                <BadgeIcon className="h-4.5 w-4.5" />
              </span>
              <div>
                <h2 className="text-[15px] font-bold text-[var(--ink)]">{detailItem.people?.name || 'Verificação'}</h2>
                <p className="text-[12px] text-[var(--muted)]">{formatDateTime(detailItem.createdAt)}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setDetailItem(null)
                setShowRejectForm(false)
                setRejectNotes('')
                setActionError(null)
              }}
              className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--page)] hover:text-[var(--ink)]"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="mx-auto flex w-full min-h-0 max-w-[900px] flex-1 flex-col overflow-y-auto px-4 py-6 sm:px-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">CPF/CNPJ</p>
                <p className="mt-0.5 text-[13.5px] font-medium text-[var(--ink)]">{detailItem.people?.document || '—'}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">Telefone</p>
                <p className="mt-0.5 text-[13.5px] font-medium text-[var(--ink)]">
                  {detailItem.people?.phone ? formatPhone(detailItem.people.phone) : '—'}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">Status</p>
                <span className={`mt-1 inline-block rounded-full px-2.5 py-1 text-[11px] font-bold ${statusBadgeClass(detailItem.status)}`}>
                  {STATUS_LABELS[detailItem.status]}
                </span>
              </div>
              {detailItem.notes && (
                <div>
                  <p className="text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">Observações</p>
                  <p className="mt-0.5 text-[13.5px] text-[var(--ink)]">{detailItem.notes}</p>
                </div>
              )}
            </div>

            <div className="mt-6 grid gap-4 rounded-xl border border-[var(--border)] p-4 sm:grid-cols-2">
              <div>
                <p className="text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">Nome do pai</p>
                <p className="mt-0.5 text-[13.5px] text-[var(--ink)]">{detailItem.people?.fatherName || '—'}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">Nome da mãe</p>
                <p className="mt-0.5 text-[13.5px] text-[var(--ink)]">{detailItem.people?.motherName || '—'}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">Onde trabalha</p>
                <p className="mt-0.5 text-[13.5px] text-[var(--ink)]">{detailItem.people?.employerName || '—'}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">Ocupação</p>
                <p className="mt-0.5 text-[13.5px] text-[var(--ink)]">{detailItem.people?.occupation || '—'}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">Renda mensal</p>
                <p className="mt-0.5 text-[13.5px] text-[var(--ink)]">{formatMoney(detailItem.people?.monthlyIncome)}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">Moradia</p>
                <p className="mt-0.5 text-[13.5px] text-[var(--ink)]">
                  {detailItem.housingType === 'rented' ? 'Alugada' : detailItem.housingType === 'own' ? 'Própria' : '—'}
                </p>
              </div>
            </div>

            <div className="mt-4">
              <p className="text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">Referências pessoais</p>
              {detailItem.references && detailItem.references.length > 0 ? (
                <div className="mt-2 flex flex-col gap-2">
                  {detailItem.references.map((reference, index) => (
                    <div key={index} className="flex items-center justify-between rounded-xl border border-[var(--border)] px-3.5 py-2.5">
                      <span className="text-[13px] font-medium text-[var(--ink)]">{reference.name}</span>
                      <span className="text-[13px] text-[var(--ink-soft)]">{formatPhone(reference.phone)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-[13px] text-[var(--muted)]">Nenhuma referência informada.</p>
              )}
            </div>

            <div className="mt-6">
              <p className="text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                Documentos ({documents.length})
              </p>
              {documents.length > 0 ? (
                <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {documents.map((doc, index) => {
                    const isImage = isImageUrl(doc.url)
                    const isPdf = isPdfUrl(doc.url)
                    return (
                      <button
                        key={doc.title}
                        type="button"
                        onClick={() => setLightboxIndex(index)}
                        className="group overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--page)] text-left"
                      >
                        {isImage ? (
                          <img src={doc.url} alt={doc.title} className="h-32 w-full object-cover transition group-hover:opacity-90" />
                        ) : (
                          <div className="flex h-32 w-full flex-col items-center justify-center gap-1.5 text-[var(--muted)]">
                            <FileTextIcon className="h-8 w-8" />
                            {isPdf && <span className="text-[10.5px] font-semibold">PDF</span>}
                          </div>
                        )}
                        <p className="truncate px-2 py-1.5 text-[11.5px] font-medium text-[var(--ink-soft)]">{doc.title}</p>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <p className="mt-2 text-[13px] text-[var(--muted)]">Nenhum documento enviado ainda.</p>
              )}
            </div>

            {showRejectForm && (
              <div className="mt-6 rounded-xl border border-[var(--red-100)] bg-[var(--red-100)]/40 p-4">
                <label className="text-[12px] font-semibold text-[var(--ink-soft)]">Motivo da reprovação (o cliente vai ver isso)</label>
                <textarea
                  rows={3}
                  value={rejectNotes}
                  onChange={(event) => setRejectNotes(event.target.value)}
                  placeholder="Ex: comprovante de endereço ilegível, tente enviar de novo com mais luz."
                  className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-[13.5px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none"
                />
              </div>
            )}

            {actionError && (
              <div className="mt-4 rounded-xl bg-[var(--red-100)] p-3 text-[13px] font-medium text-[var(--red-500)]">
                {actionError}
              </div>
            )}
          </div>

          {canReview && (
            <div className="mx-auto flex w-full max-w-[900px] flex-wrap items-center justify-end gap-2.5 border-t border-[var(--border)] px-6 py-4">
              {showRejectForm ? (
                <>
                  <button
                    type="button"
                    onClick={() => setShowRejectForm(false)}
                    disabled={reviewing}
                    className="rounded-xl px-4 py-2.5 text-[13px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)] disabled:opacity-60"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReview('rejected', rejectNotes.trim() || undefined)}
                    disabled={reviewing}
                    className="flex items-center gap-2 rounded-xl bg-[var(--red-500)] px-4 py-2.5 text-[13px] font-bold text-white transition hover:bg-red-600 disabled:opacity-60"
                  >
                    <XCircleIcon className="h-4 w-4" />
                    {reviewing ? 'Enviando…' : 'Confirmar reprovação'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setShowRejectForm(true)}
                    disabled={reviewing}
                    className="flex items-center gap-2 rounded-xl bg-[var(--red-100)] px-4 py-2.5 text-[13px] font-bold text-[var(--red-500)] transition hover:bg-red-200 disabled:opacity-60"
                  >
                    <XCircleIcon className="h-4 w-4" />
                    Reprovar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReview('approved')}
                    disabled={reviewing}
                    className="flex items-center gap-2 rounded-xl bg-[var(--green-100)] px-4 py-2.5 text-[13px] font-bold text-[var(--green-600)] transition hover:bg-green-200 disabled:opacity-60"
                  >
                    <CheckCircleIcon className="h-4 w-4" />
                    {reviewing ? 'Enviando…' : 'Aprovar'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {lightboxIndex !== null && documents[lightboxIndex] && (
        <DocumentViewerModal
          documents={documents}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
        />
      )}
    </div>
  )
}
