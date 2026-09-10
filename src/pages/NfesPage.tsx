import { useEffect, useMemo, useState } from 'react'
import {
  fetchNfes,
  deleteNfe,
  sendNfe,
  forceSendNfe,
  cancelNfe,
  skipNfeNumber,
  fetchNfeLogs,
  fetchNfeFileUrl,
  NFE_STATUS_LABELS,
  type NfeRecord,
  type NfeSendLogRecord,
} from '../lib/nfes'
import { fetchPeople, type PersonRecord } from '../lib/people'
import { formatCurrency, formatDate, formatDateTime } from '../lib/format'
import { ApiError } from '../lib/api'
import {
  SearchIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  DownloadIcon,
  RefreshIcon,
  XCircleIcon,
  AlertTriangleIcon,
  ClipboardCheckIcon,
  ArrowUpCircleIcon,
} from '../components/icons'
import { SortableTh } from '../components/SortableTh'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { RowActionsMenu, type RowAction } from '../components/RowActionsMenu'
import { SearchSelectField } from '../components/form/SearchSelectField'
import type { AuthSession, AuthCompany } from '../lib/auth'

interface NfesPageProps {
  session: AuthSession
  company: AuthCompany
  onCreate: () => void
  onEdit: (nfe: NfeRecord) => void
}

const PAGE_SIZE = 10

type SortField = 'code' | 'data_emissao' | 'valor_total' | 'status'

function statusTone(status: number): string {
  if (status === 2) return 'bg-[var(--green-100)] text-[var(--green-600)]'
  if (status === 3) return 'bg-[var(--red-100)] text-[var(--red-500)]'
  if (status === 4) return 'bg-[var(--page)] text-[var(--muted)]'
  if (status === 1) return 'bg-[var(--blue-100)] text-[var(--blue-700)]'
  return 'bg-[var(--amber-100)] text-[var(--amber-500)]'
}

export function NfesPage({ session, company, onCreate, onEdit }: NfesPageProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [personFilter, setPersonFilter] = useState<{ id: string; label: string } | null>(null)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortField, setSortField] = useState<SortField>('code')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)

  const [nfes, setNfes] = useState<NfeRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<NfeRecord | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const [cancelTarget, setCancelTarget] = useState<NfeRecord | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)

  const [logsTarget, setLogsTarget] = useState<NfeRecord | null>(null)
  const [logs, setLogs] = useState<NfeSendLogRecord[]>([])
  const [logsLoading, setLogsLoading] = useState(false)

  function reload() {
    setLoading(true)
    setError(null)
    fetchNfes(session.token.token, company.id, {
      limit: 500,
      dateStart: dateFrom || undefined,
      dateEnd: dateTo || undefined,
      peopleId: personFilter?.id,
    })
      .then((res) => setNfes(res.data || []))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Não foi possível carregar as notas fiscais.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.token.token, company.id, dateFrom, dateTo, personFilter])

  useEffect(() => {
    setPage(1)
  }, [search, statusFilter, dateFrom, dateTo, personFilter, sortField, sortDirection])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return nfes.filter((nfe) => {
      if (statusFilter !== 'all' && String(nfe.status) !== statusFilter) return false
      if (!term) return true
      return String(nfe.code ?? '').includes(term) || (nfe.people?.name ?? '').toLowerCase().includes(term)
    })
  }, [nfes, search, statusFilter])

  const sorted = useMemo(() => {
    const items = [...filtered]
    const direction = sortDirection === 'asc' ? 1 : -1
    items.sort((a, b) => {
      switch (sortField) {
        case 'data_emissao': {
          const aTime = a.data_emissao ? new Date(a.data_emissao).getTime() : 0
          const bTime = b.data_emissao ? new Date(b.data_emissao).getTime() : 0
          return (aTime - bTime) * direction
        }
        case 'valor_total':
          return ((a.valor_total ?? 0) - (b.valor_total ?? 0)) * direction
        case 'status':
          return (a.status - b.status) * direction
        case 'code':
        default:
          return ((a.code ?? 0) - (b.code ?? 0)) * direction
      }
    })
    return items
  }, [filtered, sortField, sortDirection])

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection((current) => (current === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const lastPage = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const visible = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    const id = deleteTarget.id
    setDeleting(true)
    try {
      await deleteNfe(session.token.token, id)
      setDeleteTarget(null)
      setNfes((prev) => prev.filter((nfe) => nfe.id !== id))
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Não foi possível excluir a NF-e.')
    } finally {
      setDeleting(false)
    }
  }

  async function handleSend(nfe: NfeRecord) {
    setBusyId(nfe.id)
    setActionError(null)
    setActionMessage(null)
    try {
      const res = await sendNfe(session.token.token, nfe.id)
      setActionMessage(res.mensagem)
      reload()
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Não foi possível enviar a NF-e.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleForceSend(nfe: NfeRecord) {
    setBusyId(nfe.id)
    setActionError(null)
    setActionMessage(null)
    try {
      const res = await forceSendNfe(session.token.token, nfe.id)
      setActionMessage(res.mensagem)
      reload()
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Não foi possível forçar o reenvio da NF-e.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleSkipNumber(nfe: NfeRecord) {
    setBusyId(nfe.id)
    setActionError(null)
    setActionMessage(null)
    try {
      await skipNfeNumber(session.token.token, nfe.id)
      setActionMessage('Numeração pulada com sucesso.')
      reload()
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Não foi possível pular a numeração da NF-e.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleDownload(nfe: NfeRecord, type: 'xml' | 'danfe') {
    setBusyId(nfe.id)
    setActionError(null)
    try {
      const url = await fetchNfeFileUrl(session.token.token, nfe.id, type)
      window.open(url, '_blank')
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : `Não foi possível baixar o ${type === 'xml' ? 'XML' : 'DANFE'}.`)
    } finally {
      setBusyId(null)
    }
  }

  async function handleConfirmCancel() {
    if (!cancelTarget) return
    if (cancelReason.trim().length < 15) {
      setCancelError('A justificativa precisa ter pelo menos 15 caracteres.')
      return
    }
    setCancelling(true)
    setCancelError(null)
    try {
      await cancelNfe(session.token.token, cancelTarget.id, cancelReason.trim())
      setCancelTarget(null)
      setCancelReason('')
      reload()
    } catch (err) {
      setCancelError(err instanceof ApiError ? err.message : 'Não foi possível cancelar a NF-e.')
    } finally {
      setCancelling(false)
    }
  }

  function openLogs(nfe: NfeRecord) {
    setLogsTarget(nfe)
    setLogsLoading(true)
    fetchNfeLogs(session.token.token, nfe.id)
      .then((res) => setLogs(res || []))
      .catch(() => setLogs([]))
      .finally(() => setLogsLoading(false))
  }

  function buildRowActions(nfe: NfeRecord): RowAction[] {
    const actions: RowAction[] = []

    if (nfe.status === 0) {
      actions.push(
        { key: 'edit', label: 'Editar', icon: <PencilIcon className="h-4 w-4" />, onClick: () => onEdit(nfe) },
        { key: 'send', label: 'Enviar', icon: <ArrowUpCircleIcon className="h-4 w-4" />, onClick: () => handleSend(nfe) }
      )
    }

    if (nfe.status === 1 || nfe.status === 3) {
      actions.push({
        key: 'force-send',
        label: 'Forçar reenvio',
        icon: <RefreshIcon className="h-4 w-4" />,
        onClick: () => handleForceSend(nfe),
      })
    }

    if (nfe.status === 3) {
      actions.push({
        key: 'skip-number',
        label: 'Pular numeração',
        icon: <AlertTriangleIcon className="h-4 w-4" />,
        tone: 'warning',
        onClick: () => handleSkipNumber(nfe),
      })
    }

    if (nfe.status === 2) {
      actions.push({
        key: 'cancel',
        label: 'Cancelar',
        icon: <XCircleIcon className="h-4 w-4" />,
        tone: 'danger',
        onClick: () => setCancelTarget(nfe),
      })
    }

    if (nfe.status === 2 || nfe.status === 4) {
      actions.push(
        {
          key: 'xml',
          label: 'Baixar XML',
          icon: <DownloadIcon className="h-4 w-4" />,
          onClick: () => handleDownload(nfe, 'xml'),
        },
        {
          key: 'danfe',
          label: 'Baixar DANFE',
          icon: <DownloadIcon className="h-4 w-4" />,
          onClick: () => handleDownload(nfe, 'danfe'),
        }
      )
    }

    actions.push({
      key: 'logs',
      label: 'Ver logs',
      icon: <ClipboardCheckIcon className="h-4 w-4" />,
      onClick: () => openLogs(nfe),
    })

    if (nfe.status === 0) {
      actions.push({
        key: 'delete',
        label: 'Excluir',
        icon: <TrashIcon className="h-4 w-4" />,
        tone: 'danger',
        dividerBefore: true,
        onClick: () => setDeleteTarget(nfe),
      })
    }

    return actions
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Fiscal</p>
          <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">Notas Fiscais</h1>
        </div>
        <button
          type="button"
          onClick={onCreate}
          className="flex items-center gap-2 rounded-xl bg-[var(--blue-500)] px-4 py-2.5 text-[13.5px] font-bold text-white transition hover:bg-[var(--blue-700)]"
        >
          <PlusIcon className="h-4 w-4" />
          Nova NFe
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5">
          <SearchIcon className="h-4 w-4 flex-none text-[var(--muted)]" />
          <input
            type="text"
            placeholder="Buscar por código ou cliente"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full bg-transparent text-[13.5px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none"
          />
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Status</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-[13.5px] text-[var(--ink)] focus:outline-none"
          >
            <option value="all">Todos</option>
            {Object.entries(NFE_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <div className="min-w-[220px] flex-1">
          <SearchSelectField
            label="Cliente"
            placeholder="Buscar por nome"
            variant="surface"
            selectedLabel={personFilter?.label ?? null}
            onSearch={(query) =>
              fetchPeople(session.token.token, company.id, { search: query, limit: 8 }).then((res) => res.data)
            }
            getOptionLabel={(item: PersonRecord) => item.name}
            onSelect={(item: PersonRecord) => setPersonFilter({ id: item.id, label: item.name })}
            onClear={() => setPersonFilter(null)}
          />
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold text-[var(--ink-soft)]">De</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-[13.5px] text-[var(--ink)] focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Até</span>
          <input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-[13.5px] text-[var(--ink)] focus:outline-none"
          />
        </label>
        {(personFilter || dateFrom || dateTo || statusFilter !== 'all') && (
          <button
            type="button"
            onClick={() => {
              setPersonFilter(null)
              setDateFrom('')
              setDateTo('')
              setStatusFilter('all')
            }}
            className="rounded-xl px-3.5 py-2.5 text-[12.5px] font-semibold text-[var(--blue-700)] hover:underline"
          >
            Limpar filtros
          </button>
        )}
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
        ) : visible.length === 0 ? (
          <p className="py-10 text-center text-[13.5px] text-[var(--muted)]">
            Nenhuma nota fiscal encontrada{search ? ` para "${search}"` : ''}.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-fixed border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                  <SortableTh
                    label="Número"
                    field="code"
                    className="w-[12%] px-2 pb-2.5"
                    activeField={sortField}
                    direction={sortDirection}
                    onSort={handleSort}
                  />
                  <th className="w-[28%] px-2 pb-2.5">Cliente</th>
                  <SortableTh
                    label="Emissão"
                    field="data_emissao"
                    className="w-[16%] px-2 pb-2.5"
                    activeField={sortField}
                    direction={sortDirection}
                    onSort={handleSort}
                  />
                  <SortableTh
                    label="Valor"
                    field="valor_total"
                    align="right"
                    className="w-[16%] px-2 pb-2.5 text-right"
                    activeField={sortField}
                    direction={sortDirection}
                    onSort={handleSort}
                  />
                  <SortableTh
                    label="Status"
                    field="status"
                    className="w-[18%] px-2 pb-2.5"
                    activeField={sortField}
                    direction={sortDirection}
                    onSort={handleSort}
                  />
                  <th className="w-10 pb-2.5 pr-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((nfe, index) => (
                  <tr
                    key={nfe.id}
                    className={`border-b border-[var(--border)] align-top transition-colors last:border-none hover:bg-[var(--blue-100)] ${
                      index % 2 === 1 ? 'bg-[var(--page)]' : ''
                    }`}
                  >
                    <td className="px-2 py-2.5">
                      <span className="rounded-lg bg-[var(--blue-100)] px-2 py-1 text-[11px] font-bold text-[var(--blue-700)]">
                        {nfe.serie ?? '—'}/{nfe.numero ?? nfe.code ?? '—'}
                      </span>
                    </td>
                    <td className="px-2 py-2.5">
                      <p className="truncate text-[13.5px] font-semibold text-[var(--ink)]" title={nfe.people?.name}>
                        {nfe.people?.name || '—'}
                      </p>
                    </td>
                    <td className="px-2 py-2.5 text-[var(--ink-soft)]">{formatDate(nfe.data_emissao)}</td>
                    <td className="px-2 py-2.5 text-right font-bold text-[var(--green-600)]">
                      {formatCurrency(nfe.valor_total ?? 0)}
                    </td>
                    <td className="px-2 py-2.5">
                      <span className={`rounded-full px-2 py-1 text-[10.5px] font-bold leading-tight ${statusTone(nfe.status)}`}>
                        {busyId === nfe.id ? 'Processando…' : (NFE_STATUS_LABELS[nfe.status] ?? '—')}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-right">
                      <div className="flex items-center justify-end">
                        <RowActionsMenu actions={buildRowActions(nfe)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && lastPage > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-[12px] text-[var(--muted)]">{filtered.length} NF-e no total</p>
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
                {page} / {lastPage}
              </span>
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

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Excluir NF-e"
        message={`Tem certeza que deseja excluir o rascunho #${deleteTarget?.code}? Essa ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setCancelTarget(null)}>
          <div
            className="w-full max-w-[440px] rounded-2xl bg-[var(--surface)] p-6 shadow-[var(--card-shadow)]"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-[15px] font-bold text-[var(--ink)]">Cancelar NF-e #{cancelTarget.code}</h2>
            <p className="mt-1 text-[12.5px] text-[var(--muted)]">
              Informe a justificativa do cancelamento (mínimo 15 caracteres). Essa ação é enviada à SEFAZ e não pode
              ser desfeita.
            </p>
            <textarea
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              rows={3}
              placeholder="Ex: Emissão em duplicidade"
              className="mt-3 w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[13.5px] text-[var(--ink)] ring-1 ring-transparent transition placeholder:text-[var(--muted)] focus:outline-none focus:ring-[var(--blue-300)]"
            />
            {cancelError && <p className="mt-2 text-[12.5px] font-medium text-[var(--red-500)]">{cancelError}</p>}
            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={cancelling}
                className="rounded-xl bg-[var(--red-500)] px-5 py-2.5 text-[13.5px] font-bold text-white transition hover:opacity-90 disabled:opacity-60"
              >
                {cancelling ? 'Cancelando…' : 'Confirmar cancelamento'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCancelTarget(null)
                  setCancelReason('')
                  setCancelError(null)
                }}
                className="rounded-xl px-4 py-2.5 text-[13.5px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]"
              >
                Voltar
              </button>
            </div>
          </div>
        </div>
      )}

      {logsTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setLogsTarget(null)}>
          <div
            className="max-h-[80vh] w-full max-w-[560px] overflow-y-auto rounded-2xl bg-[var(--surface)] p-6 shadow-[var(--card-shadow)]"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-[15px] font-bold text-[var(--ink)]">Logs — NF-e #{logsTarget.code}</h2>
            {logsLoading ? (
              <div className="mt-4 flex flex-col gap-2">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="h-14 animate-pulse rounded-xl bg-[var(--page)]" />
                ))}
              </div>
            ) : logs.length === 0 ? (
              <p className="mt-4 text-[13px] text-[var(--muted)]">Nenhum log registrado ainda.</p>
            ) : (
              <div className="mt-4 flex flex-col gap-2.5">
                {logs.map((log) => (
                  <div key={log.id} className="rounded-xl bg-[var(--page)] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12.5px] font-bold text-[var(--ink)]">
                        {log.phase} · {log.action}
                      </span>
                      <span className="text-[11px] text-[var(--muted)]">{formatDateTime(log.created_at)}</span>
                    </div>
                    {log.error_message && (
                      <p className="mt-1.5 text-[12px] font-medium text-[var(--red-500)]">{log.error_message}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => setLogsTarget(null)}
              className="mt-5 w-full rounded-xl px-4 py-2.5 text-[13px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {(actionMessage || actionError) && (
        <div
          className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg ${
            actionError ? 'bg-[var(--red-500)]' : 'bg-[var(--green-600)]'
          }`}
        >
          {actionError || actionMessage}
        </div>
      )}
    </div>
  )
}
