import { useEffect, useRef, useState } from 'react'
import {
  fetchNfeManifests,
  fetchNfeManifestSummary,
  enqueueNfeManifestSync,
  manifestNfe,
  importNfeManifestPurchaseNote,
  confirmPurchaseNoteEntry,
  fetchNfeManifestFileUrl,
  fetchNfeManifestLogs,
  formatNfeProviderError,
  deriveManifestStatus,
  NFE_MANIFEST_TIPO_OPTIONS,
  NFE_MANIFEST_LOG_PHASE_LABELS,
  NFE_MANIFEST_LOG_ACTION_LABELS,
  type NfeReceivedManifestRecord,
  type NfeManifestSummary,
  type NfeManifestTipo,
  type NfeManifestLogRecord,
  type PurchaseNoteRecord,
} from '../lib/nfeManifests'
import { formatCurrency, formatDateTime } from '../lib/format'
import { formatLogPayload } from '../lib/logs'
import { ApiError } from '../lib/api'
import { useNfeManifestSyncUpdates } from '../hooks/useNfeManifestSyncUpdates'
import {
  SearchIcon,
  RefreshIcon,
  CheckCircleIcon,
  ArrowDownCircleIcon,
  ClipboardCheckIcon,
  EyeIcon,
  DownloadIcon,
  CloseIcon,
} from '../components/icons'
import { RowActionsMenu, type RowAction } from '../components/RowActionsMenu'
import { DocumentViewerModal } from '../components/DocumentViewerModal'
import type { AuthSession, AuthCompany } from '../lib/auth'

interface NfeManifestsPageProps {
  session: AuthSession
  company: AuthCompany
}

const PAGE_SIZE = 10
const SYNC_TIMEOUT_MS = 45000

const STATUS_TILES: { key: string; label: string; tone: string; bar: string }[] = [
  { key: 'pending', label: 'Pendentes', tone: 'text-[var(--amber-500)]', bar: 'bg-[var(--amber-500)]' },
  { key: 'manifested', label: 'Manifestadas', tone: 'text-[var(--blue-700)]', bar: 'bg-[var(--blue-500)]' },
  { key: 'imported', label: 'Importadas', tone: 'text-[var(--green-600)]', bar: 'bg-[var(--green-600)]' },
  { key: 'all', label: 'Todas', tone: 'text-[var(--ink)]', bar: 'bg-[var(--muted)]' },
]

function currentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function NfeManifestsPage({ session, company }: NfeManifestsPageProps) {
  const [search, setSearch] = useState('')
  const [month, setMonth] = useState(currentMonth())
  const [statusFilter, setStatusFilter] = useState('pending')
  const [page, setPage] = useState(1)

  const [manifests, setManifests] = useState<NfeReceivedManifestRecord[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [summary, setSummary] = useState<NfeManifestSummary | null>(null)

  const [syncing, setSyncing] = useState(false)
  const [syncJobId, setSyncJobId] = useState<string | null>(null)
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const [manifestTarget, setManifestTarget] = useState<NfeReceivedManifestRecord | null>(null)
  const [manifestTipo, setManifestTipo] = useState<NfeManifestTipo>('ciencia')
  const [manifestJustificativa, setManifestJustificativa] = useState('')
  const [manifestSaving, setManifestSaving] = useState(false)
  const [manifestError, setManifestError] = useState<string | null>(null)

  const [reviewNote, setReviewNote] = useState<PurchaseNoteRecord | null>(null)
  const [confirmingEntry, setConfirmingEntry] = useState(false)

  const [logsTarget, setLogsTarget] = useState<NfeReceivedManifestRecord | 'global' | null>(null)
  const [logs, setLogs] = useState<NfeManifestLogRecord[]>([])
  const [logsLoading, setLogsLoading] = useState(false)

  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewTarget, setPreviewTarget] = useState<NfeReceivedManifestRecord | null>(null)

  function reload() {
    setLoading(true)
    setError(null)
    fetchNfeManifests(session.token.token, company.id, {
      search: search || undefined,
      date: month || undefined,
      status: statusFilter,
      page,
      limit: PAGE_SIZE,
    })
      .then((res) => {
        setManifests(res.data || [])
        setTotal(res.meta?.total ?? (res.data || []).length)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Não foi possível carregar as notas recebidas.'))
      .finally(() => setLoading(false))
  }

  function loadSummary() {
    fetchNfeManifestSummary(session.token.token, company.id, month || undefined)
      .then(setSummary)
      .catch(() => setSummary(null))
  }

  useEffect(() => {
    reload()
    loadSummary()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.token.token, company.id, month])

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter, page])

  useEffect(() => {
    setPage(1)
  }, [search, statusFilter, month])

  useNfeManifestSyncUpdates(company.id, (job) => {
    if (!syncJobId || job.id !== syncJobId) return
    if (Number(job.status) === 2 || Number(job.status) === 3) {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current)
      setSyncing(false)
      setSyncJobId(null)
      if (Number(job.status) === 3 && job.last_error) {
        setActionError(job.last_error)
      } else {
        setActionMessage('Consulta concluída — lista atualizada.')
      }
      reload()
      loadSummary()
    }
  })

  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current)
    }
  }, [])

  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE))

  async function handleSync() {
    setSyncing(true)
    setActionError(null)
    setActionMessage(null)
    try {
      const res = await enqueueNfeManifestSync(session.token.token, company.id, month || undefined)
      setActionMessage(res.message)
      if (Number(res.job.status) === 1 || Number(res.job.status) === 0) {
        setSyncJobId(res.job.id)
        if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current)
        syncTimeoutRef.current = setTimeout(() => {
          setSyncing(false)
          setSyncJobId(null)
        }, SYNC_TIMEOUT_MS)
      } else {
        setSyncing(false)
      }
    } catch (err) {
      setSyncing(false)
      setActionError(formatNfeProviderError(err, 'Não foi possível consultar novas notas.'))
    }
  }

  function openManifestModal(manifest: NfeReceivedManifestRecord) {
    setManifestTarget(manifest)
    setManifestTipo('ciencia')
    setManifestJustificativa('')
    setManifestError(null)
  }

  async function handleConfirmManifest() {
    if (!manifestTarget) return
    const requiresJustificativa = manifestTipo === 'desconhecimento' || manifestTipo === 'nao_realizada'
    if (requiresJustificativa && manifestJustificativa.trim().length < 15) {
      setManifestError('Informe uma justificativa com pelo menos 15 caracteres.')
      return
    }
    setManifestSaving(true)
    setManifestError(null)
    try {
      await manifestNfe(session.token.token, manifestTarget.id, company.id, {
        tipo: manifestTipo,
        justificativa: requiresJustificativa ? manifestJustificativa.trim() : undefined,
      })
      setManifestTarget(null)
      reload()
      loadSummary()
    } catch (err) {
      setManifestError(formatNfeProviderError(err, 'Não foi possível registrar o manifesto.'))
    } finally {
      setManifestSaving(false)
    }
  }

  async function handleImport(manifest: NfeReceivedManifestRecord) {
    setBusyId(manifest.id)
    setActionError(null)
    setActionMessage(null)
    try {
      const note = await importNfeManifestPurchaseNote(session.token.token, manifest.id, company.id)
      setReviewNote(note)
      reload()
      loadSummary()
    } catch (err) {
      setActionError(formatNfeProviderError(err, 'Não foi possível importar a nota como entrada.'))
    } finally {
      setBusyId(null)
    }
  }

  async function handleConfirmEntry() {
    if (!reviewNote) return
    setConfirmingEntry(true)
    try {
      await confirmPurchaseNoteEntry(session.token.token, reviewNote.id)
      setReviewNote(null)
      setActionMessage('Entrada de estoque confirmada.')
    } catch (err) {
      setActionError(formatNfeProviderError(err, 'Não foi possível confirmar a entrada de estoque.'))
      setReviewNote(null)
    } finally {
      setConfirmingEntry(false)
    }
  }

  async function handleDownload(manifest: NfeReceivedManifestRecord, type: 'xml' | 'danfe') {
    setBusyId(manifest.id)
    setActionError(null)
    try {
      const url = await fetchNfeManifestFileUrl(session.token.token, manifest.id, company.id, type)
      window.open(url, '_blank')
    } catch (err) {
      setActionError(formatNfeProviderError(err, `Não foi possível baixar o ${type === 'xml' ? 'XML' : 'DANFE'}.`))
    } finally {
      setBusyId(null)
    }
  }

  async function handlePreview(manifest: NfeReceivedManifestRecord) {
    setBusyId(manifest.id)
    setActionError(null)
    try {
      const url = await fetchNfeManifestFileUrl(session.token.token, manifest.id, company.id, 'danfe')
      setPreviewTarget(manifest)
      setPreviewUrl(url)
    } catch (err) {
      setActionError(formatNfeProviderError(err, 'Não foi possível visualizar o DANFE.'))
    } finally {
      setBusyId(null)
    }
  }

  function openLogs(target: NfeReceivedManifestRecord | 'global') {
    setLogsTarget(target)
    setLogsLoading(true)
    fetchNfeManifestLogs(session.token.token, company.id, target === 'global' ? undefined : target.id)
      .then((res) => setLogs(res || []))
      .catch(() => setLogs([]))
      .finally(() => setLogsLoading(false))
  }

  function buildRowActions(manifest: NfeReceivedManifestRecord): RowAction[] {
    const status = deriveManifestStatus(manifest)
    const actions: RowAction[] = [
      {
        key: 'manifest',
        label: 'Manifestar',
        icon: <CheckCircleIcon className="h-4 w-4" />,
        onClick: () => openManifestModal(manifest),
      },
    ]

    if (status.key === 'confirmed' && !manifest.purchase_note_id) {
      actions.push({
        key: 'import',
        label: 'Importar entrada',
        icon: <ArrowDownCircleIcon className="h-4 w-4" />,
        onClick: () => handleImport(manifest),
      })
    }

    actions.push({
      key: 'logs',
      label: 'Logs',
      icon: <ClipboardCheckIcon className="h-4 w-4" />,
      onClick: () => openLogs(manifest),
    })

    actions.push(
      {
        key: 'preview',
        label: 'Visualizar / Imprimir DANFE',
        icon: <EyeIcon className="h-4 w-4" />,
        dividerBefore: true,
        onClick: () => handlePreview(manifest),
      },
      {
        key: 'danfe',
        label: 'Baixar DANFE',
        icon: <DownloadIcon className="h-4 w-4" />,
        onClick: () => handleDownload(manifest, 'danfe'),
      },
      {
        key: 'xml',
        label: 'Baixar XML',
        icon: <DownloadIcon className="h-4 w-4" />,
        onClick: () => handleDownload(manifest, 'xml'),
      }
    )

    return actions
  }

  const requiresJustificativa = manifestTipo === 'desconhecimento' || manifestTipo === 'nao_realizada'

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Fiscal</p>
          <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">Manifesto NF-e</h1>
          <p className="mt-1 text-[12.5px] text-[var(--muted)]">
            Consulte e acompanhe as notas emitidas contra o CNPJ da empresa.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openLogs('global')}
            className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-[13.5px] font-bold text-[var(--ink-soft)] transition hover:text-[var(--ink)]"
          >
            <ClipboardCheckIcon className="h-4 w-4" />
            Logs
          </button>
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 rounded-xl bg-[var(--blue-500)] px-4 py-2.5 text-[13.5px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:opacity-60"
          >
            <RefreshIcon className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Consultando…' : 'Consultar notas'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STATUS_TILES.map((tile) => {
          const bucket = summary?.[tile.key as keyof NfeManifestSummary]
          const active = statusFilter === tile.key
          return (
            <button
              key={tile.key}
              type="button"
              onClick={() => setStatusFilter(tile.key)}
              className={`relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-left transition ${
                active ? 'opacity-100' : 'opacity-40 hover:opacity-70'
              }`}
            >
              <span className={`absolute inset-x-0 top-0 h-1 ${tile.bar}`} />
              <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">{tile.label}</p>
              <p className={`mt-1 text-[18px] font-bold ${tile.tone}`}>{bucket?.count ?? '—'}</p>
              <p className="mt-0.5 text-[12px] text-[var(--muted)]">{formatCurrency(bucket?.sum ?? 0)}</p>
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5">
          <SearchIcon className="h-4 w-4 flex-none text-[var(--muted)]" />
          <input
            type="text"
            placeholder="Buscar por emitente, CNPJ ou chave"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full bg-transparent text-[13.5px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none"
          />
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Mês</span>
          <input
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-[13.5px] text-[var(--ink)] focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Status</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-[13.5px] text-[var(--ink)] focus:outline-none"
          >
            <option value="pending">Pendentes</option>
            <option value="all">Todas</option>
            <option value="manifested">Manifestadas</option>
            <option value="imported">Importadas</option>
          </select>
        </label>
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
        ) : manifests.length === 0 ? (
          <p className="py-10 text-center text-[13.5px] text-[var(--muted)]">Nenhuma nota recebida encontrada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-fixed border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                  <th className="w-[30%] px-2 pb-2.5">Emitente</th>
                  <th className="w-[24%] px-2 pb-2.5">Chave</th>
                  <th className="w-[16%] px-2 pb-2.5">Emissão</th>
                  <th className="w-[14%] px-2 pb-2.5 text-right">Valor</th>
                  <th className="w-[16%] px-2 pb-2.5">Status</th>
                  <th className="w-10 pb-2.5 pr-3 text-right">Opções</th>
                </tr>
              </thead>
              <tbody>
                {manifests.map((manifest, index) => {
                  const status = deriveManifestStatus(manifest)
                  return (
                    <tr
                      key={manifest.id}
                      className={`border-b border-[var(--border)] align-top transition-colors last:border-none hover:bg-[var(--blue-100)] ${
                        index % 2 === 1 ? 'bg-[var(--page)]' : ''
                      }`}
                    >
                      <td className="px-2 py-2.5">
                        <p className="truncate text-[13.5px] font-semibold text-[var(--ink)]" title={manifest.nome_emitente ?? undefined}>
                          {manifest.nome_emitente || '—'}
                        </p>
                        <p className="truncate text-[11.5px] text-[var(--muted)]">{manifest.documento_emitente || '—'}</p>
                      </td>
                      <td className="truncate px-2 py-2.5 font-mono text-[11.5px] text-[var(--muted)]" title={manifest.chave_nfe}>
                        {manifest.chave_nfe}
                      </td>
                      <td className="px-2 py-2.5 text-[var(--ink-soft)]">{formatDateTime(manifest.data_emissao)}</td>
                      <td className="px-2 py-2.5 text-right font-bold text-[var(--green-600)]">
                        {formatCurrency(manifest.valor_total ?? 0)}
                      </td>
                      <td className="px-2 py-2.5">
                        <span className={`rounded-full px-2 py-1 text-[10.5px] font-bold leading-tight ${status.tone}`}>
                          {busyId === manifest.id ? 'Processando…' : status.label}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-right">
                        <div className="flex items-center justify-end">
                          <RowActionsMenu actions={buildRowActions(manifest)} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && lastPage > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-[12px] text-[var(--muted)]">{total} notas no total</p>
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

      {manifestTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setManifestTarget(null)}
        >
          <div
            className="w-full max-w-[460px] rounded-2xl bg-[var(--surface)] p-6 shadow-[var(--card-shadow)]"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-[15px] font-bold text-[var(--ink)]">Manifestar nota</h2>
            <p className="mt-1 text-[12.5px] text-[var(--muted)]">{manifestTarget.nome_emitente}</p>

            <label className="mt-4 flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Operação</span>
              <select
                value={manifestTipo}
                onChange={(event) => setManifestTipo(event.target.value as NfeManifestTipo)}
                className="rounded-xl border border-[var(--border)] bg-[var(--page)] px-3.5 py-2.5 text-[13.5px] text-[var(--ink)] focus:outline-none"
              >
                {NFE_MANIFEST_TIPO_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} — {option.hint}
                  </option>
                ))}
              </select>
            </label>

            {requiresJustificativa && (
              <label className="mt-3 flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Justificativa</span>
                <textarea
                  value={manifestJustificativa}
                  onChange={(event) => setManifestJustificativa(event.target.value)}
                  rows={3}
                  placeholder="Mínimo 15 caracteres"
                  className="w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[13.5px] text-[var(--ink)] ring-1 ring-transparent transition placeholder:text-[var(--muted)] focus:outline-none focus:ring-[var(--blue-300)]"
                />
              </label>
            )}

            {manifestError && (
              <p className="mt-2 whitespace-pre-wrap text-[12.5px] font-medium text-[var(--red-500)]">{manifestError}</p>
            )}

            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={handleConfirmManifest}
                disabled={manifestSaving}
                className="rounded-xl bg-[var(--blue-500)] px-5 py-2.5 text-[13.5px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:opacity-60"
              >
                {manifestSaving ? 'Enviando…' : 'Confirmar'}
              </button>
              <button
                type="button"
                onClick={() => setManifestTarget(null)}
                className="rounded-xl px-4 py-2.5 text-[13.5px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {reviewNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setReviewNote(null)}>
          <div
            className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-[var(--surface)] shadow-[var(--card-shadow)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] p-5">
              <div>
                <h2 className="text-[15px] font-bold text-[var(--ink)]">Entrada importada</h2>
                <p className="text-[12px] text-[var(--muted)]">
                  {reviewNote.issuer?.name} · #{reviewNote.code}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReviewNote(null)}
                className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--page)] hover:text-[var(--ink)]"
                aria-label="Fechar"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <p className="mb-3 text-[12.5px] text-[var(--muted)]">
                A nota de compra foi criada como rascunho — a entrada de estoque ainda não foi confirmada.
              </p>
              <div className="overflow-hidden rounded-xl border border-[var(--border)]">
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--page)] text-left text-[10.5px] font-bold uppercase tracking-wide text-[var(--muted)]">
                      <th className="px-3 py-2">Produto</th>
                      <th className="px-3 py-2 text-right">Qtd</th>
                      <th className="px-3 py-2 text-right">Custo</th>
                      <th className="px-3 py-2 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(reviewNote.products || []).map((item) => (
                      <tr key={item.id} className="border-b border-[var(--border)] last:border-none">
                        <td className="px-3 py-2 text-[var(--ink)]">{item.product?.name || item.description || '—'}</td>
                        <td className="px-3 py-2 text-right text-[var(--ink-soft)]">
                          {item.amount} {item.unit}
                        </td>
                        <td className="px-3 py-2 text-right text-[var(--ink-soft)]">{formatCurrency(item.cost_value ?? 0)}</td>
                        <td className="px-3 py-2 text-right font-semibold text-[var(--ink)]">
                          {formatCurrency(item.subtotal ?? 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-right text-[13.5px] font-bold text-[var(--green-600)]">
                Total: {formatCurrency(reviewNote.total ?? 0)}
              </p>
            </div>

            <div className="flex items-center gap-3 border-t border-[var(--border)] p-4">
              <button
                type="button"
                onClick={handleConfirmEntry}
                disabled={confirmingEntry}
                className="rounded-xl bg-[var(--green-600)] px-5 py-2.5 text-[13.5px] font-bold text-white transition hover:opacity-90 disabled:opacity-60"
              >
                {confirmingEntry ? 'Confirmando…' : 'Confirmar entrada de estoque'}
              </button>
              <button
                type="button"
                onClick={() => setReviewNote(null)}
                className="rounded-xl px-4 py-2.5 text-[13.5px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]"
              >
                Deixar como rascunho
              </button>
            </div>
          </div>
        </div>
      )}

      {logsTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setLogsTarget(null)}>
          <div
            className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-[var(--surface)] p-6 shadow-[var(--card-shadow)]"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-[15px] font-bold text-[var(--ink)]">
              {logsTarget === 'global' ? 'Logs — Manifesto NF-e' : `Logs — ${logsTarget.nome_emitente}`}
            </h2>
            {logsLoading ? (
              <div className="mt-4 flex flex-col gap-2">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="h-14 animate-pulse rounded-xl bg-[var(--page)]" />
                ))}
              </div>
            ) : logs.length === 0 ? (
              <p className="mt-4 text-[13px] text-[var(--muted)]">Nenhum log registrado ainda.</p>
            ) : (
              <div className="mt-4 flex flex-col gap-3">
                {logs.map((log) => (
                  <div key={log.id} className="rounded-xl bg-[var(--page)] p-3.5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded-full bg-[var(--blue-100)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--blue-700)]">
                          {(log.phase && NFE_MANIFEST_LOG_PHASE_LABELS[log.phase]) || log.phase || '—'}
                        </span>
                        <span className="text-[12.5px] font-bold text-[var(--ink)]">
                          {(log.action && NFE_MANIFEST_LOG_ACTION_LABELS[log.action]) || log.action || '—'}
                        </span>
                        {log.http_status && (
                          <span className="rounded-full bg-[var(--blue-100)] px-2 py-0.5 text-[10.5px] font-semibold text-[var(--blue-700)]">
                            HTTP {log.http_status}
                          </span>
                        )}
                      </div>
                      <span className="flex-none text-[11px] text-[var(--muted)]">{formatDateTime(log.created_at)}</span>
                    </div>

                    {log.error_message && (
                      <p className="mt-2 whitespace-pre-wrap text-[12.5px] font-medium text-[var(--red-500)]">
                        {log.error_message}
                      </p>
                    )}

                    {(log.request_payload || log.response_payload) && (
                      <div className="mt-3 grid gap-2.5 xl:grid-cols-2">
                        {log.request_payload && (
                          <div>
                            <p className="mb-1 text-[10.5px] font-bold uppercase tracking-wide text-[var(--muted)]">Request</p>
                            <pre className="max-h-64 overflow-auto rounded-lg bg-[var(--ink)] p-2.5 text-[11px] leading-5 text-white">
                              {formatLogPayload(log.request_payload)}
                            </pre>
                          </div>
                        )}
                        {log.response_payload && (
                          <div>
                            <p className="mb-1 text-[10.5px] font-bold uppercase tracking-wide text-[var(--muted)]">Response</p>
                            <pre className="max-h-64 overflow-auto rounded-lg bg-[var(--ink)] p-2.5 text-[11px] leading-5 text-white">
                              {formatLogPayload(log.response_payload)}
                            </pre>
                          </div>
                        )}
                      </div>
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

      {previewUrl && (
        <DocumentViewerModal
          documents={[
            {
              title: `DANFE — ${previewTarget?.chave_nfe ?? ''}`,
              url: previewUrl,
              fileName: `${previewTarget?.chave_nfe ?? 'danfe'}.pdf`,
              type: 'pdf',
            },
          ]}
          index={0}
          onIndexChange={() => {}}
          onClose={() => {
            URL.revokeObjectURL(previewUrl)
            setPreviewUrl(null)
            setPreviewTarget(null)
          }}
        />
      )}

      {(actionMessage || actionError) && (
        <div
          className={`fixed bottom-6 left-1/2 z-50 max-h-[40vh] w-full max-w-lg -translate-x-1/2 overflow-y-auto whitespace-pre-wrap rounded-xl px-4 py-2.5 text-left text-[13px] font-semibold text-white shadow-lg ${
            actionError ? 'bg-[var(--red-500)]' : 'bg-[var(--green-600)]'
          }`}
        >
          {actionError || actionMessage}
          <button
            type="button"
            onClick={() => {
              setActionError(null)
              setActionMessage(null)
            }}
            className="ml-3 font-bold underline decoration-white/60 underline-offset-2 hover:decoration-white"
          >
            Fechar
          </button>
        </div>
      )}
    </div>
  )
}
