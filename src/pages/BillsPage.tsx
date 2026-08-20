import { useEffect, useRef, useState } from 'react'
import { fetchBills, deleteBill, deleteBillsSelected, billStatusLabel, type BillRecord } from '../lib/bills'
import { formatCurrency, formatDate } from '../lib/format'
import { ApiError } from '../lib/api'
import { getCached, setCached } from '../lib/cache'
import { useRowSelection } from '../hooks/useRowSelection'
import { SearchIcon, PlusIcon, PencilIcon, ChevronDownIcon, TrashIcon, PrinterIcon } from '../components/icons'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { PrintPreviewModal, type PrintColumn } from '../components/PrintPreviewModal'
import type { AuthSession, AuthCompany } from '../lib/auth'

interface BillsPageProps {
  session: AuthSession
  company: AuthCompany
  role: 0 | 1
  onCreate: () => void
  onEdit: (bill: BillRecord) => void
}

type PeriodKey = 'all' | 'today' | '7d' | 'month'

const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: 'all', label: 'Tudo' },
  { key: 'today', label: 'Hoje' },
  { key: '7d', label: '7 dias' },
  { key: 'month', label: 'Este mês' },
]

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function getPeriodRange(key: PeriodKey): { start?: string; end?: string } {
  const now = new Date()
  if (key === 'today') {
    const today = toISODate(now)
    return { start: today, end: today }
  }
  if (key === '7d') {
    const start = new Date(now)
    start.setDate(start.getDate() - 6)
    return { start: toISODate(start), end: toISODate(now) }
  }
  if (key === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return { start: toISODate(start), end: toISODate(end) }
  }
  return {}
}

function statusTone(status: number): string {
  if (status === 1) return 'bg-[var(--green-100)] text-[var(--green-600)]'
  if (status === 2) return 'bg-[var(--blue-100)] text-[var(--blue-700)]'
  return 'bg-[var(--amber-100)] text-[var(--amber-500)]'
}

export function BillsPage({ session, company, role, onCreate, onEdit }: BillsPageProps) {
  const title = role === 1 ? 'Contas a Receber' : 'Contas a Pagar'
  const personLabel = role === 1 ? 'Cliente' : 'Fornecedor'
  const [period, setPeriod] = useState<PeriodKey>('month')
  const [search, setSearch] = useState('')
  const [statusType, setStatusType] = useState('')
  const [page, setPage] = useState(1)
  const [bills, setBills] = useState<BillRecord[]>([])
  const [meta, setMeta] = useState({ total: 0, lastPage: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { selected, toggle, toggleAll, clear, setSelected } = useRowSelection()
  const [deleteTarget, setDeleteTarget] = useState<BillRecord | null>(null)
  const [deletingSelected, setDeletingSelected] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [printOpen, setPrintOpen] = useState(false)

  const [refreshKey, setRefreshKey] = useState(0)
  const skipCacheOnce = useRef(false)

  const PRINT_COLUMNS: PrintColumn[] = [
    { key: 'code', label: 'Código' },
    { key: 'name', label: 'Descrição' },
    { key: 'person', label: personLabel },
    { key: 'category', label: 'Categoria' },
    { key: 'dueDate', label: 'Vencimento' },
    { key: 'status', label: 'Status' },
    { key: 'amount', label: 'Valor', align: 'right' },
  ]

  useEffect(() => {
    let cancelled = false
    const { start, end } = getPeriodRange(period)
    const cacheKey = `bills:${company.id}:${role}:${period}:${statusType}:${page}:${search}`
    const cached = skipCacheOnce.current ? undefined : getCached<{ bills: BillRecord[]; meta: typeof meta }>(cacheKey)
    skipCacheOnce.current = false

    if (cached) {
      setBills(cached.bills)
      setMeta(cached.meta)
      setLoading(false)
    } else {
      setLoading(true)
    }
    setError(null)

    const timeout = setTimeout(
      () => {
        fetchBills(session.token.token, company.id, {
          search,
          page,
          limit: 10,
          role,
          statusType: statusType === '' ? undefined : Number(statusType),
          dateStart: start,
          dateEnd: end,
        })
          .then((res) => {
            if (cancelled) return
            const nextBills = res.data || []
            const nextMeta = { total: res.meta?.total ?? res.data?.length ?? 0, lastPage: res.meta?.last_page ?? 1 }
            setBills(nextBills)
            setMeta(nextMeta)
            setCached(cacheKey, { bills: nextBills, meta: nextMeta })
            clear()
          })
          .catch((err) => {
            if (cancelled) return
            setError(err instanceof ApiError ? err.message : 'Não foi possível carregar as contas.')
          })
          .finally(() => {
            if (!cancelled) setLoading(false)
          })
      },
      cached ? 0 : 350
    )

    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusType, period, page, role, company.id, session.token.token, refreshKey])

  useEffect(() => {
    setPage(1)
  }, [search, statusType, period, role])

  function reload() {
    skipCacheOnce.current = true
    setRefreshKey((key) => key + 1)
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteBill(session.token.token, deleteTarget.id)
      setDeleteTarget(null)
      reload()
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Não foi possível excluir a conta.')
    } finally {
      setDeleting(false)
    }
  }

  async function handleConfirmDeleteSelected() {
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteBillsSelected(session.token.token, Array.from(selected))
      setDeletingSelected(false)
      setSelected(new Set())
      reload()
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Não foi possível excluir as contas selecionadas.')
    } finally {
      setDeleting(false)
    }
  }

  const selectedBills = bills.filter((bill) => selected.has(bill.id))
  const printRows = selectedBills.map((bill) => ({
    code: `#${bill.code}`,
    name: bill.name,
    person: bill.people?.name ?? '—',
    category: bill.category?.name ?? '—',
    dueDate: formatDate(bill.date_due),
    status: billStatusLabel(bill.status, role),
    amount: formatCurrency(bill.amount),
  }))

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Financeiro</p>
          <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">{title}</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1">
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setPeriod(option.key)}
                className={`rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition ${
                  period === option.key ? 'bg-[var(--blue-500)] text-white' : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onCreate}
            className="flex items-center gap-2 rounded-xl bg-[var(--blue-500)] px-4 py-2.5 text-[13.5px] font-bold text-white transition hover:bg-[var(--blue-700)]"
          >
            <PlusIcon className="h-4 w-4" />
            {role === 1 ? 'Nova conta a receber' : 'Nova conta a pagar'}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5">
          <SearchIcon className="h-4 w-4 flex-none text-[var(--muted)]" />
          <input
            type="text"
            placeholder="Buscar por nome, código ou pessoa"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full bg-transparent text-[13.5px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none"
          />
        </div>
        <div className="relative flex w-[200px] flex-none items-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5">
          <select
            value={statusType}
            onChange={(event) => setStatusType(event.target.value)}
            className="w-full appearance-none bg-transparent text-[13.5px] text-[var(--ink)] focus:outline-none"
          >
            <option value="">Todos os status</option>
            <option value="0">Pendente</option>
            <option value="1">{role === 1 ? 'Recebido' : 'Pago'}</option>
          </select>
          <ChevronDownIcon className="pointer-events-none h-3.5 w-3.5 flex-none text-[var(--muted)]" />
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[var(--blue-100)] px-4 py-3">
          <span className="text-[13px] font-bold text-[var(--blue-700)]">
            {selected.size} selecionado{selected.size === 1 ? '' : 's'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPrintOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-[var(--surface)] px-3.5 py-2 text-[12.5px] font-bold text-[var(--blue-700)] hover:bg-white"
            >
              <PrinterIcon className="h-3.5 w-3.5" />
              Imprimir selecionados
            </button>
            <button
              type="button"
              onClick={() => setDeletingSelected(true)}
              className="flex items-center gap-1.5 rounded-xl bg-[var(--surface)] px-3.5 py-2 text-[12.5px] font-bold text-[var(--red-500)] hover:bg-white"
            >
              <TrashIcon className="h-3.5 w-3.5" />
              Excluir selecionados
            </button>
            <button
              type="button"
              onClick={clear}
              className="rounded-xl px-3.5 py-2 text-[12.5px] font-semibold text-[var(--blue-700)] hover:underline"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-2xl bg-[var(--red-100)] p-4 text-[13.5px] font-medium text-[var(--red-500)]">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        {loading ? (
          <div className="flex flex-col gap-2.5">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-11 animate-pulse rounded-xl bg-[var(--page)]" />
            ))}
          </div>
        ) : bills.length === 0 ? (
          <p className="py-10 text-center text-[13.5px] text-[var(--muted)]">
            Nenhuma conta encontrada{search ? ` para "${search}"` : ''}.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                  <th className="w-10 pb-2.5 pl-3">
                    <input
                      type="checkbox"
                      checked={bills.length > 0 && bills.every((b) => selected.has(b.id))}
                      onChange={() => toggleAll(bills.map((b) => b.id))}
                      className="h-4 w-4 accent-[var(--blue-500)]"
                      aria-label="Selecionar todos"
                    />
                  </th>
                  <th className="pb-2.5">Código</th>
                  <th className="pb-2.5">Descrição</th>
                  <th className="pb-2.5">{personLabel}</th>
                  <th className="pb-2.5">Categoria</th>
                  <th className="pb-2.5">Vencimento</th>
                  <th className="pb-2.5">Status</th>
                  <th className="pb-2.5 text-right">Valor</th>
                  <th className="pb-2.5 pr-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {bills.map((bill, index) => (
                  <tr
                    key={bill.id}
                    className={`border-b border-[var(--border)] transition-colors last:border-none hover:bg-[var(--blue-100)] ${
                      index % 2 === 1 ? 'bg-[var(--page)]' : ''
                    } ${selected.has(bill.id) ? 'bg-[var(--blue-100)]' : ''}`}
                  >
                    <td className="py-2.5 pl-3">
                      <input
                        type="checkbox"
                        checked={selected.has(bill.id)}
                        onChange={() => toggle(bill.id)}
                        className="h-4 w-4 accent-[var(--blue-500)]"
                        aria-label={`Selecionar ${bill.name}`}
                      />
                    </td>
                    <td className="py-2.5 font-mono text-[var(--ink-soft)]">#{bill.code}</td>
                    <td className="py-2.5 font-medium text-[var(--ink)]">{bill.name}</td>
                    <td className="py-2.5 text-[var(--ink-soft)]">{bill.people?.name ?? '—'}</td>
                    <td className="py-2.5 text-[var(--ink-soft)]">{bill.category?.name ?? '—'}</td>
                    <td className="py-2.5 text-[var(--ink-soft)]">{formatDate(bill.date_due)}</td>
                    <td className="py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase ${statusTone(bill.status)}`}>
                        {billStatusLabel(bill.status, role)}
                      </span>
                    </td>
                    <td className="py-2.5 text-right font-mono font-semibold text-[var(--ink)]">
                      {formatCurrency(bill.amount)}
                    </td>
                    <td className="py-2.5 pr-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => onEdit(bill)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--ink)]"
                          aria-label="Editar"
                        >
                          <PencilIcon className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(bill)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--red-100)] hover:text-[var(--red-500)]"
                          aria-label="Excluir"
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && meta.lastPage > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-[12px] text-[var(--muted)]">{meta.total} contas no total</p>
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
        title="Excluir conta"
        message={`Tem certeza que deseja excluir "${deleteTarget?.name}"? Essa ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setDeleteTarget(null)
          setDeleteError(null)
        }}
      />

      <ConfirmDialog
        open={deletingSelected}
        title="Excluir selecionadas"
        message={`Tem certeza que deseja excluir ${selected.size} conta${selected.size === 1 ? '' : 's'}? Essa ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        loading={deleting}
        onConfirm={handleConfirmDeleteSelected}
        onCancel={() => {
          setDeletingSelected(false)
          setDeleteError(null)
        }}
      />

      {deleteError && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-[var(--red-500)] px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg">
          {deleteError}
        </div>
      )}

      <PrintPreviewModal
        open={printOpen}
        company={company}
        title={title}
        subtitle={`${company.people?.name ?? ''} · ${printRows.length} registro${printRows.length === 1 ? '' : 's'}`}
        columns={PRINT_COLUMNS}
        rows={printRows}
        onClose={() => setPrintOpen(false)}
      />
    </div>
  )
}
