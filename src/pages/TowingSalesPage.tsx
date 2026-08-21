import { useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchTowingSales,
  deleteTowingSale,
  deleteTowingSalesSelected,
  updateTowingSaleStatus,
  getContractLink,
  TOWING_SALE_SIGNED_STATUS,
  TOWING_SALE_CANCELED_STATUS,
  TOWING_SALE_COMPLETED_STATUS,
  type TowingSaleRecord,
} from '../lib/towingSale'
import { SALE_STATUS_LABELS, COLLECTION_STATUS_LABELS, getSaleValue } from '../lib/towingDashboard'
import { formatCurrency } from '../lib/format'
import { formatDocument } from '../lib/formatDocument'
import { formatPhone } from '../lib/formatPhone'
import { ApiError } from '../lib/api'
import { getCached, setCached } from '../lib/cache'
import { useRowSelection } from '../hooks/useRowSelection'
import {
  SearchIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  PrinterIcon,
  LinkIcon,
  CheckCircleIcon,
  XCircleIcon,
  TruckIcon,
  WhatsappIcon,
} from '../components/icons'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { PrintPreviewModal, type PrintColumn } from '../components/PrintPreviewModal'
import { RowActionsMenu, type RowAction } from '../components/RowActionsMenu'
import { TowingContractPreviewModal } from '../components/TowingContractPreviewModal'
import { TowingSendContractModal } from '../components/TowingSendContractModal'
import type { AuthSession, AuthCompany } from '../lib/auth'

interface TowingSalesPageProps {
  session: AuthSession
  company: AuthCompany
  onCreate: () => void
  onEdit: (sale: TowingSaleRecord) => void
}

type PeriodKey = 'all' | 'today' | '7d' | 'month'

const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: 'all', label: 'Tudo' },
  { key: 'today', label: 'Hoje' },
  { key: '7d', label: '7 dias' },
  { key: 'month', label: 'Este mês' },
]

const PAGE_SIZE = 10

const PRINT_COLUMNS: PrintColumn[] = [
  { key: 'code', label: 'Código' },
  { key: 'client', label: 'Cliente' },
  { key: 'vehicle', label: 'Veículo' },
  { key: 'trajectory', label: 'Trajeto' },
  { key: 'status', label: 'Status' },
  { key: 'value', label: 'Valor', align: 'right' },
]

interface StatusBucket {
  key: string
  status: number
  label: string
  barVar: string
  textVar: string
}

const STATUS_BUCKETS: StatusBucket[] = [
  { key: '4', status: 4, label: 'Cancelados', barVar: '--red-500', textVar: '--red-500' },
  { key: '0', status: 0, label: 'Orçamentos', barVar: '--blue-500', textVar: '--blue-700' },
  { key: '2', status: 2, label: 'Aguardando', barVar: '--amber-500', textVar: '--amber-500' },
  { key: '3', status: 3, label: 'Assinados', barVar: '--green-600', textVar: '--green-600' },
  { key: '5', status: 5, label: 'Concluídas', barVar: '--indigo-500', textVar: '--indigo-500' },
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

function saleStatusBadgeClass(status: number): string {
  switch (status) {
    case 1:
      return 'bg-[var(--blue-100)] text-[var(--blue-700)]'
    case 2:
      return 'bg-[var(--amber-100)] text-[var(--amber-500)]'
    case 3:
      return 'bg-[var(--green-100)] text-[var(--green-600)]'
    case 4:
      return 'bg-[var(--red-100)] text-[var(--red-500)]'
    case 5:
      return 'bg-[var(--indigo-100)] text-[var(--indigo-500)]'
    default:
      return 'bg-[var(--page)] text-[var(--ink-soft)]'
  }
}

function collectionStatusBadgeClass(value: number): string {
  switch (value) {
    case 1:
      return 'bg-[var(--blue-100)] text-[var(--blue-700)]'
    case 2:
      return 'bg-[var(--red-100)] text-[var(--red-500)]'
    case 3:
      return 'bg-[var(--amber-100)] text-[var(--amber-500)]'
    case 4:
      return 'bg-[var(--green-100)] text-[var(--green-600)]'
    default:
      return 'bg-[var(--page)] text-[var(--ink-soft)]'
  }
}

function vehicleLabel(sale: TowingSaleRecord): string {
  const parts = [sale.vehicle?.brand, sale.vehicle?.model].filter(Boolean)
  return parts.length ? parts.join(' ') : '—'
}

function vehicleSummary(sale: TowingSaleRecord): string {
  const label = vehicleLabel(sale)
  return sale.vehicle?.license_plate ? `${sale.vehicle.license_plate} · ${label}` : label
}

function formatAddress(address?: string, number?: string, city?: string, state?: string): string {
  return [address, number, city, state].filter(Boolean).join(', ')
}

function trajectory(sale: TowingSaleRecord): string {
  const origin = formatAddress(sale.origin_address, sale.origin_number, sale.origin_city, sale.origin_state)
  const destination = formatAddress(
    sale.destination_address,
    sale.destination_number,
    sale.destination_city,
    sale.destination_state
  )
  return [origin, destination].filter(Boolean).join(' → ') || '—'
}

export function TowingSalesPage({ session, company, onCreate, onEdit }: TowingSalesPageProps) {
  const [period, setPeriod] = useState<PeriodKey>('month')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('total')
  const [page, setPage] = useState(1)
  const [sales, setSales] = useState<TowingSaleRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { selected, toggle, toggleAll, clear, setSelected } = useRowSelection()
  const [deleteTarget, setDeleteTarget] = useState<TowingSaleRecord | null>(null)
  const [deletingSelected, setDeletingSelected] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [printOpen, setPrintOpen] = useState(false)

  const [contractSale, setContractSale] = useState<TowingSaleRecord | null>(null)
  const [sendContractSale, setSendContractSale] = useState<TowingSaleRecord | null>(null)
  const [statusConfirm, setStatusConfirm] = useState<{
    sale: TowingSaleRecord
    status: number
    title: string
    message: string
  } | null>(null)
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)

  const [refreshKey, setRefreshKey] = useState(0)
  const skipCacheOnce = useRef(false)

  useEffect(() => {
    if (!feedback) return
    const timeout = setTimeout(() => setFeedback(null), 3200)
    return () => clearTimeout(timeout)
  }, [feedback])

  useEffect(() => {
    let cancelled = false
    const { start, end } = getPeriodRange(period)
    const cacheKey = `towing-sales:${company.id}:${period}`
    const cached = skipCacheOnce.current ? undefined : getCached<TowingSaleRecord[]>(cacheKey)
    skipCacheOnce.current = false

    if (cached) {
      setSales(cached)
      setLoading(false)
    } else {
      setLoading(true)
    }
    setError(null)

    fetchTowingSales(session.token.token, company.id, { dateStart: start, dateEnd: end })
      .then((res) => {
        if (cancelled) return
        const nextSales = res.data || []
        setSales(nextSales)
        setCached(cacheKey, nextSales)
        clear()
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof ApiError ? err.message : 'Não foi possível carregar as vendas.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, company.id, session.token.token, refreshKey])

  useEffect(() => {
    setPage(1)
  }, [search, statusFilter, period])

  function reload() {
    skipCacheOnce.current = true
    setRefreshKey((key) => key + 1)
  }

  function silentReload() {
    const { start, end } = getPeriodRange(period)
    const cacheKey = `towing-sales:${company.id}:${period}`
    fetchTowingSales(session.token.token, company.id, { dateStart: start, dateEnd: end })
      .then((res) => {
        const nextSales = res.data || []
        setSales(nextSales)
        setCached(cacheKey, nextSales)
      })
      .catch(() => {})
  }

  const bucketStats = useMemo(() => {
    const stats: Record<string, { count: number; total: number }> = {}
    for (const bucket of STATUS_BUCKETS) {
      const matching = sales.filter((sale) => Number(sale.status || 0) === bucket.status)
      stats[bucket.key] = {
        count: matching.length,
        total: matching.reduce((sum, sale) => sum + getSaleValue(sale), 0),
      }
    }
    stats.total = {
      count: sales.length,
      total: sales.reduce((sum, sale) => sum + getSaleValue(sale), 0),
    }
    return stats
  }, [sales])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return sales.filter((sale) => {
      if (statusFilter !== 'total' && Number(sale.status || 0) !== Number(statusFilter)) return false
      if (!term) return true
      return (
        String(sale.code).includes(term) ||
        (sale.people?.name ?? '').toLowerCase().includes(term) ||
        (sale.vehicle?.license_plate ?? '').toLowerCase().includes(term)
      )
    })
  }, [sales, search, statusFilter])

  const lastPage = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    const deletedId = deleteTarget.id
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteTowingSale(session.token.token, deletedId)
      setDeleteTarget(null)
      setSales((prev) => prev.filter((sale) => sale.id !== deletedId))
      silentReload()
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Não foi possível excluir a venda.')
    } finally {
      setDeleting(false)
    }
  }

  async function handleConfirmDeleteSelected() {
    const deletedIds = new Set(selected)
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteTowingSalesSelected(session.token.token, Array.from(selected))
      setDeletingSelected(false)
      setSales((prev) => prev.filter((sale) => !deletedIds.has(sale.id)))
      setSelected(new Set())
      silentReload()
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Não foi possível excluir as vendas selecionadas.')
    } finally {
      setDeleting(false)
    }
  }

  function handleCopyContractLink(sale: TowingSaleRecord) {
    const link = getContractLink(sale)
    if (!link) return
    navigator.clipboard
      .writeText(link)
      .then(() => setFeedback({ tone: 'success', message: 'Link copiado.' }))
      .catch(() => setFeedback({ tone: 'error', message: 'Não foi possível copiar o link.' }))
  }

  async function handleConfirmStatusChange() {
    if (!statusConfirm) return
    setStatusUpdating(true)
    try {
      await updateTowingSaleStatus(session.token.token, statusConfirm.sale.id, statusConfirm.status)
      let message = 'Venda cancelada.'
      if (statusConfirm.status === TOWING_SALE_COMPLETED_STATUS) message = 'Venda concluída.'
      else if (statusConfirm.status === TOWING_SALE_SIGNED_STATUS) message = 'Assinatura confirmada.'
      setFeedback({ tone: 'success', message })
      setStatusConfirm(null)
      reload()
    } catch (err) {
      setFeedback({
        tone: 'error',
        message: err instanceof ApiError ? err.message : 'Não foi possível atualizar o status da venda.',
      })
    } finally {
      setStatusUpdating(false)
    }
  }

  function buildRowActions(sale: TowingSaleRecord): RowAction[] {
    const status = Number(sale.status || 0)
    const actions: RowAction[] = [
      {
        key: 'edit',
        label: 'Editar',
        icon: <PencilIcon className="h-4 w-4" />,
        onClick: () => onEdit(sale),
      },
    ]

    if (status !== TOWING_SALE_CANCELED_STATUS) {
      actions.push({
        key: 'contract',
        label: 'Visualizar contrato',
        icon: <PrinterIcon className="h-4 w-4" />,
        onClick: () => setContractSale(sale),
      })
    }

    if (![TOWING_SALE_SIGNED_STATUS, TOWING_SALE_CANCELED_STATUS].includes(status)) {
      actions.push({
        key: 'send-contract',
        label: 'Contrato e envio',
        icon: <WhatsappIcon className="h-4 w-4" />,
        onClick: () => setSendContractSale(sale),
      })
    }

    if (getContractLink(sale)) {
      actions.push({
        key: 'copy-link',
        label: 'Copiar link assinatura',
        icon: <LinkIcon className="h-4 w-4" />,
        onClick: () => handleCopyContractLink(sale),
      })
    }

    if (![TOWING_SALE_SIGNED_STATUS, TOWING_SALE_CANCELED_STATUS, TOWING_SALE_COMPLETED_STATUS].includes(status)) {
      actions.push({
        key: 'confirm-signature',
        label: 'Confirmar assinatura',
        icon: <CheckCircleIcon className="h-4 w-4" />,
        onClick: () =>
          setStatusConfirm({
            sale,
            status: TOWING_SALE_SIGNED_STATUS,
            title: 'Confirmar assinatura',
            message: `Confirmar contrato assinado pelo cliente na venda #${sale.code}?`,
          }),
      })
    }

    if (status === TOWING_SALE_SIGNED_STATUS) {
      actions.push({
        key: 'complete',
        label: 'Concluir venda',
        icon: <CheckCircleIcon className="h-4 w-4" />,
        onClick: () =>
          setStatusConfirm({
            sale,
            status: TOWING_SALE_COMPLETED_STATUS,
            title: 'Concluir venda',
            message: `Confirmar a conclusão da venda #${sale.code}?`,
          }),
      })
    }

    if (![TOWING_SALE_CANCELED_STATUS, TOWING_SALE_COMPLETED_STATUS].includes(status)) {
      actions.push({
        key: 'cancel',
        label: 'Cancelar venda',
        icon: <XCircleIcon className="h-4 w-4" />,
        tone: 'danger',
        onClick: () =>
          setStatusConfirm({
            sale,
            status: TOWING_SALE_CANCELED_STATUS,
            title: 'Cancelar venda',
            message: `Confirmar o cancelamento da venda #${sale.code}?`,
          }),
      })
    }

    actions.push({
      key: 'delete',
      label: 'Deletar',
      icon: <TrashIcon className="h-4 w-4" />,
      tone: 'danger',
      dividerBefore: true,
      onClick: () => setDeleteTarget(sale),
    })

    return actions
  }

  const selectedSales = sales.filter((sale) => selected.has(sale.id))
  const printRows = selectedSales.map((sale) => ({
    code: `#${sale.code}`,
    client: sale.people?.name ?? '—',
    vehicle: vehicleLabel(sale),
    trajectory: trajectory(sale),
    status: SALE_STATUS_LABELS[Number(sale.status || 0)] ?? '—',
    value: formatCurrency(getSaleValue(sale)),
  }))

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Guincho</p>
          <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">Vendas de guincho</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
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
            Nova venda
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--card-shadow)]">
        <div className="grid grid-cols-2 divide-y divide-[var(--border)] sm:grid-cols-3 sm:divide-x sm:divide-y-0 lg:grid-cols-6">
          {STATUS_BUCKETS.map((bucket) => {
            const stats = bucketStats[bucket.key] ?? { count: 0, total: 0 }
            const isActive = statusFilter === bucket.key
            const dimmed = statusFilter !== 'total' && !isActive
            return (
              <button
                key={bucket.key}
                type="button"
                onClick={() => setStatusFilter(bucket.key)}
                className={`relative py-5 text-center transition-all duration-300 hover:bg-[var(--page)] ${
                  dimmed ? 'opacity-40' : ''
                }`}
              >
                <span
                  className="absolute left-0 right-0 top-0 transition-all duration-300"
                  style={{ height: isActive ? 6 : 0, backgroundColor: `var(${bucket.barVar})` }}
                />
                <dt className="text-[12px] font-semibold text-[var(--muted)]">
                  {bucket.label} ({stats.count})
                </dt>
                <dd className="mt-1 text-[17px] font-bold tracking-tight" style={{ color: `var(${bucket.textVar})` }}>
                  {formatCurrency(stats.total)}
                </dd>
              </button>
            )
          })}
          <button
            type="button"
            onClick={() => setStatusFilter('total')}
            className="relative py-5 text-center transition-all duration-300 hover:bg-[var(--page)]"
          >
            <span
              className="absolute left-0 right-0 top-0 bg-[var(--ink)] transition-all duration-300"
              style={{ height: statusFilter === 'total' ? 6 : 0 }}
            />
            <dt className="text-[12px] font-semibold text-[var(--muted)]">
              Total ({bucketStats.total?.count ?? 0})
            </dt>
            <dd className="mt-1 text-[17px] font-bold tracking-tight text-[var(--ink)]">
              {formatCurrency(bucketStats.total?.total ?? 0)}
            </dd>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5">
          <SearchIcon className="h-4 w-4 flex-none text-[var(--muted)]" />
          <input
            type="text"
            placeholder="Buscar por código, cliente ou placa"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full bg-transparent text-[13.5px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none"
          />
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
              <div key={index} className="h-14 animate-pulse rounded-xl bg-[var(--page)]" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <p className="py-10 text-center text-[13.5px] text-[var(--muted)]">
            Nenhuma venda encontrada{search ? ` para "${search}"` : ''}.
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-2.5 sm:hidden">
              {visible.map((sale) => {
                const status = Number(sale.status || 0)
                const collectionStatus = Number(sale.collection_status ?? 0)
                return (
                  <div
                    key={sale.id}
                    className={`rounded-xl border border-[var(--border)] p-3 ${
                      selected.has(sale.id) ? 'bg-[var(--blue-100)]' : 'bg-[var(--surface)]'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        checked={selected.has(sale.id)}
                        onChange={() => toggle(sale.id)}
                        className="mt-0.5 h-4 w-4 flex-none accent-[var(--blue-500)]"
                        aria-label={`Selecionar venda ${sale.code}`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-[13.5px] font-bold text-[var(--ink)]">
                              #{sale.code} · {sale.people?.name || '—'}
                            </p>
                            <p className="truncate text-[12px] text-[var(--muted)]">
                              {sale.people?.phone
                                ? formatPhone(sale.people.phone)
                                : sale.people?.document
                                  ? formatDocument(sale.people.document)
                                  : '—'}
                            </p>
                          </div>
                          <span className="flex-none text-[13.5px] font-bold text-[var(--ink)]">
                            {formatCurrency(getSaleValue(sale))}
                          </span>
                        </div>

                        <p className="mt-1.5 flex items-center gap-1.5 truncate text-[12px] text-[var(--ink-soft)]">
                          <TruckIcon className="h-3.5 w-3.5 flex-none text-[var(--muted)]" />
                          <span className="min-w-0 truncate">{vehicleSummary(sale)}</span>
                        </p>

                        <div className="mt-1.5 flex items-start gap-1.5 text-[12px] text-[var(--ink-soft)]">
                          <span className="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-[var(--green-600)]" />
                          <p className="min-w-0 truncate">
                            {formatAddress(sale.origin_address, sale.origin_number, sale.origin_city, sale.origin_state) ||
                              '—'}
                          </p>
                        </div>
                        <div className="mt-1 flex items-start gap-1.5 text-[12px] text-[var(--ink-soft)]">
                          <span className="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-[var(--red-500)]" />
                          <p className="min-w-0 truncate">
                            {formatAddress(
                              sale.destination_address,
                              sale.destination_number,
                              sale.destination_city,
                              sale.destination_state
                            ) || '—'}
                          </p>
                        </div>

                        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`rounded-full px-2 py-1 text-[10.5px] font-bold leading-tight ${saleStatusBadgeClass(status)}`}
                            >
                              {SALE_STATUS_LABELS[status] ?? '—'}
                            </span>
                            {status === TOWING_SALE_SIGNED_STATUS && (
                              <span
                                className={`rounded-full px-2 py-1 text-[10.5px] font-bold leading-tight ${collectionStatusBadgeClass(collectionStatus)}`}
                              >
                                {COLLECTION_STATUS_LABELS[collectionStatus] ?? '—'}
                              </span>
                            )}
                          </div>
                          <RowActionsMenu actions={buildRowActions(sale)} />
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="hidden overflow-x-auto sm:block">
            <table className="w-full table-fixed border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                  <th className="w-10 pb-2.5 pl-3">
                    <input
                      type="checkbox"
                      checked={visible.length > 0 && visible.every((s) => selected.has(s.id))}
                      onChange={() => toggleAll(visible.map((s) => s.id))}
                      className="h-4 w-4 accent-[var(--blue-500)]"
                      aria-label="Selecionar todos"
                    />
                  </th>
                  <th className="w-[28%] px-2 pb-2.5">Cliente / Veículo</th>
                  <th className="w-[11%] px-2 pb-2.5 text-right">Valor</th>
                  <th className="w-[32%] px-2 pb-2.5">Trajeto</th>
                  <th className="w-[19%] px-2 pb-2.5">Status</th>
                  <th className="w-10 pb-2.5 pr-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((sale, index) => {
                  const status = Number(sale.status || 0)
                  const collectionStatus = Number(sale.collection_status ?? 0)
                  return (
                    <tr
                      key={sale.id}
                      className={`border-b border-[var(--border)] align-top transition-colors last:border-none hover:bg-[var(--blue-100)] ${
                        index % 2 === 1 ? 'bg-[var(--page)]' : ''
                      } ${selected.has(sale.id) ? 'bg-[var(--blue-100)]' : ''}`}
                    >
                      <td className="py-2.5 pl-3">
                        <input
                          type="checkbox"
                          checked={selected.has(sale.id)}
                          onChange={() => toggle(sale.id)}
                          className="h-4 w-4 accent-[var(--blue-500)]"
                          aria-label={`Selecionar venda ${sale.code}`}
                        />
                      </td>
                      <td className="px-2 py-2.5">
                        <div className="flex items-start gap-2">
                          <span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[var(--blue-100)] text-[11px] font-bold text-[var(--blue-700)]">
                            #{sale.code}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-[13.5px] font-semibold text-[var(--ink)]" title={sale.people?.name}>
                              {sale.people?.name || '—'}
                            </p>
                            <p className="truncate text-[12px] text-[var(--muted)]">
                              {sale.people?.phone
                                ? formatPhone(sale.people.phone)
                                : sale.people?.document
                                  ? formatDocument(sale.people.document)
                                  : '—'}
                            </p>
                            <p
                              className="mt-1 flex items-center gap-1 truncate text-[12px] text-[var(--ink-soft)]"
                              title={vehicleLabel(sale)}
                            >
                              <TruckIcon className="h-3.5 w-3.5 flex-none text-[var(--muted)]" />
                              <span className="min-w-0 truncate">{vehicleSummary(sale)}</span>
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-2.5 text-right text-[13.5px] font-bold text-[var(--ink)]">
                        {formatCurrency(getSaleValue(sale))}
                      </td>
                      <td className="px-2 py-2.5 text-[12.5px] text-[var(--ink-soft)]">
                        <div className="flex items-start gap-1.5">
                          <span className="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-[var(--green-600)]" />
                          <p className="min-w-0 truncate">
                            {formatAddress(sale.origin_address, sale.origin_number, sale.origin_city, sale.origin_state) ||
                              '—'}
                          </p>
                        </div>
                        <div className="mt-1 flex items-start gap-1.5">
                          <span className="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-[var(--red-500)]" />
                          <p className="min-w-0 truncate">
                            {formatAddress(
                              sale.destination_address,
                              sale.destination_number,
                              sale.destination_city,
                              sale.destination_state
                            ) || '—'}
                          </p>
                        </div>
                      </td>
                      <td className="px-2 py-2.5">
                        <div className="flex flex-col items-start gap-1">
                          <span
                            className={`rounded-full px-2 py-1 text-[10.5px] font-bold leading-tight ${saleStatusBadgeClass(status)}`}
                          >
                            {SALE_STATUS_LABELS[status] ?? '—'}
                          </span>
                          {status === TOWING_SALE_SIGNED_STATUS && (
                            <span
                              className={`rounded-full px-2 py-1 text-[10.5px] font-bold leading-tight ${collectionStatusBadgeClass(collectionStatus)}`}
                            >
                              {COLLECTION_STATUS_LABELS[collectionStatus] ?? '—'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 pr-3 text-right">
                        <div className="flex items-center justify-end">
                          <RowActionsMenu actions={buildRowActions(sale)} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
          </>
        )}

        {!loading && lastPage > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-[12px] text-[var(--muted)]">{filtered.length} vendas no total</p>
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
        title="Excluir venda"
        message={`Tem certeza que deseja excluir a venda #${deleteTarget?.code}? Essa ação não pode ser desfeita.`}
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
        message={`Tem certeza que deseja excluir ${selected.size} venda${selected.size === 1 ? '' : 's'}? Essa ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        loading={deleting}
        onConfirm={handleConfirmDeleteSelected}
        onCancel={() => {
          setDeletingSelected(false)
          setDeleteError(null)
        }}
      />

      <ConfirmDialog
        open={Boolean(statusConfirm)}
        title={statusConfirm?.title ?? ''}
        message={statusConfirm?.message ?? ''}
        confirmLabel={
          statusConfirm?.status === TOWING_SALE_COMPLETED_STATUS
            ? 'Concluir'
            : statusConfirm?.status === TOWING_SALE_SIGNED_STATUS
              ? 'Confirmar assinatura'
              : 'Cancelar venda'
        }
        danger={statusConfirm?.status === TOWING_SALE_CANCELED_STATUS}
        loading={statusUpdating}
        onConfirm={handleConfirmStatusChange}
        onCancel={() => setStatusConfirm(null)}
      />

      {deleteError && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-[var(--red-500)] px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg">
          {deleteError}
        </div>
      )}

      {feedback && (
        <div
          className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg ${
            feedback.tone === 'success' ? 'bg-[var(--green-600)]' : 'bg-[var(--red-500)]'
          }`}
        >
          {feedback.message}
        </div>
      )}

      <PrintPreviewModal
        open={printOpen}
        company={company}
        title="Vendas de guincho"
        subtitle={`${company.people?.name ?? ''} · ${printRows.length} registro${printRows.length === 1 ? '' : 's'}`}
        columns={PRINT_COLUMNS}
        rows={printRows}
        onClose={() => setPrintOpen(false)}
      />

      <TowingContractPreviewModal
        open={Boolean(contractSale)}
        session={session}
        sale={contractSale}
        onClose={() => setContractSale(null)}
      />

      <TowingSendContractModal
        open={Boolean(sendContractSale)}
        session={session}
        company={company}
        sale={sendContractSale}
        onClose={() => setSendContractSale(null)}
        onSent={(message) => {
          setFeedback({ tone: 'success', message })
          reload()
        }}
      />
    </div>
  )
}
