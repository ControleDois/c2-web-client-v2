import { useEffect, useState } from 'react'
import {
  fetchNfses,
  deleteNfse,
  sendNfse,
  forceSendNfse,
  fetchNfseLogs,
  NFSE_STATUS_LABELS,
  type NfseRecord,
  type NfseSendLogRecord,
} from '../lib/nfse'
import { formatNfeProviderError, formatNfeMensagemSefaz } from '../lib/nfes'
import { useNfseStatusUpdates } from '../hooks/useNfseStatusUpdates'
import { ApiError } from '../lib/api'
import { extractPendencies, type Pendencies } from '../lib/pendencies'
import { PendenciesDialog } from '../components/PendenciesDialog'
import { formatCurrency, formatDateTime } from '../lib/format'
import {
  SearchIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  RefreshIcon,
  FileTextIcon,
  CloseIcon,
  AlertTriangleIcon,
  XCircleIcon,
  CopyIcon,
} from '../components/icons'
import { Select } from '../components/form/Select'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { RowActionsMenu, type RowAction } from '../components/RowActionsMenu'
import type { AuthSession, AuthCompany } from '../lib/auth'

interface NfsesPageProps {
  session: AuthSession
  company: AuthCompany
  onCreate: () => void
  onEdit: (nfse: NfseRecord) => void
}

function statusTone(status: number): string {
  if (status === 2) return 'bg-[var(--green-100)] text-[var(--green-600)]'
  if (status === 3) return 'bg-[var(--red-100)] text-[var(--red-500)]'
  if (status === 4) return 'bg-[var(--page)] text-[var(--muted)]'
  if (status === 1) return 'bg-[var(--blue-100)] text-[var(--blue-700)]'
  return 'bg-[var(--amber-100)] text-[var(--amber-500)]'
}

export function NfsesPage({ session, company, onCreate, onEdit }: NfsesPageProps) {
  const token = session.token.token
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<NfseRecord[]>([])
  const [meta, setMeta] = useState({ total: 0, lastPage: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [busyId, setBusyId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<NfseRecord | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [pendencies, setPendencies] = useState<Pendencies | null>(null)
  const [logsTarget, setLogsTarget] = useState<NfseRecord | null>(null)
  const [logs, setLogs] = useState<NfseSendLogRecord[]>([])
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [errorTarget, setErrorTarget] = useState<NfseRecord | null>(null)

  function load() {
    setLoading(true)
    setError(null)
    fetchNfses(token, company.id, {
      search: search || undefined,
      status: status === '' ? undefined : Number(status),
      page,
      limit: 20,
    })
      .then((res) => {
        setItems(res.data)
        setMeta({ total: res.meta?.total ?? res.data.length, lastPage: res.meta?.last_page ?? 1 })
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Não foi possível carregar as NFS-e.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [token, company.id, search, status, page])

  useNfseStatusUpdates(company.id, (updated) => {
    setItems((prev) => prev.map((item) => (item.id === updated.id ? { ...item, ...(updated as Partial<NfseRecord>) } : item)))
    setErrorTarget((prev) => (prev && prev.id === updated.id ? { ...prev, ...(updated as Partial<NfseRecord>) } : prev))
  })

  // Lista de pendências do cadastro abre um quadro organizado; erro simples segue no aviso.
  function showActionError(err: unknown, fallback: string) {
    const found = extractPendencies(err)
    if (found) setPendencies(found)
    else setActionError(formatNfeProviderError(err, fallback))
  }

  async function handleSend(nfse: NfseRecord) {
    setBusyId(nfse.id)
    setActionError(null)
    try {
      await sendNfse(token, nfse.id)
      load()
    } catch (err) {
      showActionError(err, 'Não foi possível enviar a NFS-e.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleForceSend(nfse: NfseRecord) {
    setBusyId(nfse.id)
    setActionError(null)
    try {
      await forceSendNfse(token, nfse.id)
      load()
    } catch (err) {
      showActionError(err, 'Não foi possível forçar o reenvio.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setBusy(true)
    setActionError(null)
    try {
      await deleteNfse(token, deleteTarget.id)
      setDeleteTarget(null)
      load()
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Não foi possível excluir a NFS-e.')
    } finally {
      setBusy(false)
    }
  }

  function openLogs(nfse: NfseRecord) {
    setLogsTarget(nfse)
    setLoadingLogs(true)
    fetchNfseLogs(token, nfse.id)
      .then(setLogs)
      .catch(() => setLogs([]))
      .finally(() => setLoadingLogs(false))
  }

  function buildActions(nfse: NfseRecord): RowAction[] {
    const actions: RowAction[] = []
    if (nfse.status === 3) {
      actions.push({
        key: 'view-error',
        label: 'Ver erro',
        icon: <AlertTriangleIcon className="h-4 w-4" />,
        tone: 'warning',
        onClick: () => setErrorTarget(nfse),
      })
    }
    if ([0, 3].includes(nfse.status)) {
      actions.push({ key: 'edit', label: 'Editar', icon: <PencilIcon className="h-4 w-4" />, onClick: () => onEdit(nfse) })
      actions.push({
        key: 'send',
        label: 'Enviar',
        icon: <FileTextIcon className="h-4 w-4" />,
        onClick: () => handleSend(nfse),
      })
    }
    if ([1, 3].includes(nfse.status)) {
      actions.push({
        key: 'force-send',
        label: 'Forçar reenvio',
        icon: <RefreshIcon className="h-4 w-4" />,
        onClick: () => handleForceSend(nfse),
      })
    }
    actions.push({
      key: 'logs',
      label: 'Ver logs',
      icon: <FileTextIcon className="h-4 w-4" />,
      onClick: () => openLogs(nfse),
    })
    if ([0, 3].includes(nfse.status)) {
      actions.push({
        key: 'delete',
        label: 'Excluir',
        icon: <TrashIcon className="h-4 w-4" />,
        tone: 'danger',
        dividerBefore: true,
        onClick: () => setDeleteTarget(nfse),
      })
    }
    return actions
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Fiscal</p>
          <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">Notas de Serviço (NFS-e)</h1>
        </div>
        <button
          type="button"
          onClick={onCreate}
          className="flex items-center gap-2 rounded-xl bg-[var(--blue-500)] px-4 py-2.5 text-[13.5px] font-bold text-white transition hover:bg-[var(--blue-700)]"
        >
          <PlusIcon className="h-4 w-4" />
          Nova NFS-e
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5">
          <SearchIcon className="h-4 w-4 flex-none text-[var(--muted)]" />
          <input
            type="text"
            placeholder="Buscar por número, chave, tomador ou serviço"
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
            value={status}
            onChange={(value) => {
              setPage(1)
              setStatus(value)
            }}
          >
            <option value="">Todos os status</option>
            {Object.entries(NFSE_STATUS_LABELS).map(([value, label]) => (
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
        ) : items.length === 0 ? (
          <p className="py-10 text-center text-[13.5px] text-[var(--muted)]">
            Nenhuma NFS-e encontrada{search ? ` para "${search}"` : ''}.
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-2.5 sm:hidden">
              {items.map((nfse) => (
                <div key={nfse.id} className="rounded-xl border border-[var(--border)] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="min-w-0 truncate text-[13.5px] font-bold text-[var(--ink)]">
                        {nfse.razao_social_tomador ?? nfse.people?.name ?? '—'}
                      </p>
                      <p className="mt-0.5 line-clamp-1 text-[12px] text-[var(--muted)]">{nfse.descricao_servico}</p>
                      <p className="mt-0.5 text-[12px] text-[var(--ink-soft)]">{formatDateTime(nfse.created_at)}</p>
                    </div>
                    <div className="flex flex-none items-start gap-1.5">
                      <div className="flex flex-col items-end gap-1.5">
                        <span className={`rounded-full px-2.5 py-1 text-[10.5px] font-bold ${statusTone(nfse.status)}`}>
                          {busyId === nfse.id ? 'Processando…' : NFSE_STATUS_LABELS[nfse.status] ?? '—'}
                        </span>
                        <span className="text-[13.5px] font-bold text-[var(--ink)]">
                          {formatCurrency(Number(nfse.valor_servico))}
                        </span>
                      </div>
                      <RowActionsMenu actions={buildActions(nfse)} />
                    </div>
                  </div>
                  {nfse.status === 3 && nfse.mensagem_sefaz && (
                    <p className="mt-2 line-clamp-2 text-[11.5px] text-[var(--red-500)]">{nfse.mensagem_sefaz}</p>
                  )}
                </div>
              ))}
            </div>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                    <th className="pb-2.5 pl-3">Tomador</th>
                    <th className="pb-2.5">Serviço</th>
                    <th className="pb-2.5">Emissão</th>
                    <th className="pb-2.5 text-right">Valor</th>
                    <th className="pb-2.5">Status</th>
                    <th className="pb-2.5 pr-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((nfse, index) => (
                    <tr
                      key={nfse.id}
                      className={`border-b border-[var(--border)] transition-colors last:border-none hover:bg-[var(--blue-100)] ${
                        index % 2 === 1 ? 'bg-[var(--page)]' : ''
                      }`}
                    >
                      <td className="py-2.5 pl-3 font-medium text-[var(--ink)]">
                        {nfse.razao_social_tomador ?? nfse.people?.name ?? '—'}
                      </td>
                      <td className="max-w-[260px] truncate py-2.5 text-[var(--ink-soft)]">{nfse.descricao_servico}</td>
                      <td className="py-2.5 whitespace-nowrap text-[var(--ink-soft)]">{formatDateTime(nfse.created_at)}</td>
                      <td className="py-2.5 text-right font-mono font-semibold text-[var(--ink)]">
                        {formatCurrency(Number(nfse.valor_servico))}
                      </td>
                      <td className="py-2.5">
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusTone(nfse.status)}`}>
                          {busyId === nfse.id ? 'Processando…' : NFSE_STATUS_LABELS[nfse.status] ?? '—'}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-right">
                        <RowActionsMenu actions={buildActions(nfse)} />
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
            <p className="text-[12px] text-[var(--muted)]">{meta.total} NFS-e no total</p>
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

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Excluir NFS-e"
        message={`Tem certeza que deseja excluir a NFS-e de "${deleteTarget?.razao_social_tomador ?? deleteTarget?.people?.name ?? ''}"? Essa ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        loading={busy}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {errorTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setErrorTarget(null)}>
          <div
            className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-[var(--surface)] shadow-[var(--card-shadow)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] p-5">
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[var(--amber-100)] text-[var(--amber-500)]">
                  <AlertTriangleIcon className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-[15px] font-bold text-[var(--ink)]">Retorno da NFS-e #{errorTarget.code}</h2>
                  <p className="text-[12px] text-[var(--muted)]">
                    {errorTarget.razao_social_tomador ?? errorTarget.people?.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setErrorTarget(null)}
                className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--page)] hover:text-[var(--ink)]"
                aria-label="Fechar"
              >
                <XCircleIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <div className="mb-4 grid grid-cols-3 gap-2.5">
                <div className="rounded-xl border border-[var(--border)] p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--muted)]">Status</p>
                  <p className="mt-1 text-[13px] font-semibold text-[var(--amber-500)]">Erro no envio</p>
                </div>
                <div className="rounded-xl border border-[var(--border)] p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--muted)]">Provedor</p>
                  <p className="mt-1 text-[13px] font-semibold text-[var(--ink)]">
                    {errorTarget.numero_dps ? `DPS ${errorTarget.serie_dps ?? '—'}/${errorTarget.numero_dps}` : '—'}
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--border)] p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--muted)]">Valor</p>
                  <p className="mt-1 text-[13px] font-semibold text-[var(--ink)]">
                    {formatCurrency(Number(errorTarget.valor_servico ?? 0))}
                  </p>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl bg-[var(--amber-100)]">
                <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--amber-500)]">
                    Mensagem retornada
                  </p>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard?.writeText(formatNfeMensagemSefaz(errorTarget.mensagem_sefaz))}
                    className="flex items-center gap-1.5 rounded-lg bg-[var(--surface)] px-2.5 py-1.5 text-[11.5px] font-bold text-[var(--amber-500)] hover:bg-white"
                  >
                    <CopyIcon className="h-3.5 w-3.5" />
                    Copiar
                  </button>
                </div>
                <pre className="max-h-[45vh] overflow-auto whitespace-pre-wrap break-words px-4 py-3 text-[12.5px] leading-6 text-[var(--ink)]">
                  {formatNfeMensagemSefaz(errorTarget.mensagem_sefaz)}
                </pre>
              </div>
            </div>

            <div className="border-t border-[var(--border)] p-4">
              <button
                type="button"
                onClick={() => setErrorTarget(null)}
                className="w-full rounded-xl bg-[var(--blue-500)] px-4 py-2.5 text-[13.5px] font-bold text-white hover:bg-[var(--blue-700)] sm:w-auto"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {logsTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setLogsTarget(null)}>
          <div
            className="flex max-h-[80vh] w-full max-w-[640px] flex-col overflow-hidden rounded-2xl bg-[var(--surface)] shadow-[var(--card-shadow)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
              <h2 className="text-[15px] font-bold text-[var(--ink)]">Logs de envio</h2>
              <button
                type="button"
                onClick={() => setLogsTarget(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--page)] hover:text-[var(--ink)]"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {loadingLogs ? (
                <p className="text-[13px] text-[var(--muted)]">Carregando…</p>
              ) : logs.length === 0 ? (
                <p className="text-[13px] text-[var(--muted)]">Nenhum log registrado ainda.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {logs.map((log) => (
                    <div key={log.id} className="rounded-xl bg-[var(--page)] p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12.5px] font-bold text-[var(--ink)]">{log.action}</span>
                        <span className="text-[11px] text-[var(--muted)]">{formatDateTime(log.created_at)}</span>
                      </div>
                      <p className="mt-0.5 text-[11px] uppercase tracking-wide text-[var(--muted)]">
                        {log.phase === 'consult' ? 'Consulta' : 'Envio'}
                        {log.http_status ? ` · HTTP ${log.http_status}` : ''}
                      </p>
                      {log.error_message && (
                        <p className="mt-1.5 text-[12px] text-[var(--red-500)]">{log.error_message}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <PendenciesDialog pendencies={pendencies} onClose={() => setPendencies(null)} />

      {actionError && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-[var(--red-500)] px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg">
          {actionError}
        </div>
      )}
    </div>
  )
}
