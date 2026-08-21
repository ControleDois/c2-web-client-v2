import { useEffect, useMemo, useState } from 'react'
import {
  fetchSales,
  deleteSale,
  VEHICLE_SALE_STATUS_LABELS,
  type SaleRecord,
  type VehicleSaleContractRecord,
} from '../lib/sales'
import { formatCurrency, formatDate } from '../lib/format'
import { ApiError } from '../lib/api'
import { getCached, setCached } from '../lib/cache'
import { useRowSelection } from '../hooks/useRowSelection'
import { SearchIcon, PlusIcon, PencilIcon, TrashIcon, PrinterIcon, TruckIcon } from '../components/icons'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { RowActionsMenu, type RowAction } from '../components/RowActionsMenu'
import { SaleContractPreviewModal } from '../components/SaleContractPreviewModal'
import type { AuthSession, AuthCompany } from '../lib/auth'

interface VehicleSalesPageProps {
  session: AuthSession
  company: AuthCompany
  onCreate: () => void
  onEdit: (sale: SaleRecord) => void
}

const PAGE_SIZE = 10

interface StatusBucket {
  key: string
  status: number
  label: string
  barVar: string
  textVar: string
}

const STATUS_BUCKETS: StatusBucket[] = [
  { key: '0', status: 0, label: 'Pendentes', barVar: '--amber-500', textVar: '--amber-500' },
  { key: '1', status: 1, label: 'Entregues', barVar: '--green-600', textVar: '--green-600' },
]

function statusTone(status: number): string {
  return status === 1 ? 'bg-[var(--green-100)] text-[var(--green-600)]' : 'bg-[var(--amber-100)] text-[var(--amber-500)]'
}

function vehicleLabel(sale: SaleRecord): string {
  const parts = [sale.vehicle?.brand, sale.vehicle?.model].filter(Boolean)
  return parts.length ? parts.join(' ') : sale.vehicle?.license_plate || '—'
}

function paymentLabel(contract: VehicleSaleContractRecord): string {
  if (contract.installmentCount && contract.installmentCount > 0) {
    return `${contract.installmentCount}x de ${formatCurrency(contract.installmentValue ?? 0)}`
  }
  return 'À vista'
}

export function VehicleSalesPage({ session, company, onCreate, onEdit }: VehicleSalesPageProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('total')
  const [page, setPage] = useState(1)
  const [sales, setSales] = useState<SaleRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { selected, toggle, toggleAll, clear, setSelected } = useRowSelection()
  const [deleteTarget, setDeleteTarget] = useState<SaleRecord | null>(null)
  const [deletingSelected, setDeletingSelected] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [contractSale, setContractSale] = useState<SaleRecord | null>(null)

  useEffect(() => {
    let cancelled = false
    const cacheKey = `vehicle-sales:${company.id}`
    const cached = getCached<SaleRecord[]>(cacheKey)

    if (cached) {
      setSales(cached)
      setLoading(false)
    } else {
      setLoading(true)
    }
    setError(null)

    fetchSales(session.token.token, company.id, { limit: 500 })
      .then((res) => {
        if (cancelled) return
        const vehicleSales = (res.data || []).filter((sale) => sale.vehicleSaleContract)
        setSales(vehicleSales)
        setCached(cacheKey, vehicleSales)
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
  }, [company.id, session.token.token])

  useEffect(() => {
    setPage(1)
  }, [search, statusFilter])

  function reload() {
    fetchSales(session.token.token, company.id, { limit: 500 })
      .then((res) => {
        const vehicleSales = (res.data || []).filter((sale) => sale.vehicleSaleContract)
        setSales(vehicleSales)
        setCached(`vehicle-sales:${company.id}`, vehicleSales)
      })
      .catch(() => {})
  }

  const bucketStats = useMemo(() => {
    const stats: Record<string, { count: number; total: number }> = {}
    for (const bucket of STATUS_BUCKETS) {
      const matching = sales.filter((sale) => Number(sale.vehicleSaleContract?.status ?? 0) === bucket.status)
      stats[bucket.key] = {
        count: matching.length,
        total: matching.reduce((sum, sale) => sum + Number(sale.vehicleSaleContract?.saleValue ?? 0), 0),
      }
    }
    stats.total = {
      count: sales.length,
      total: sales.reduce((sum, sale) => sum + Number(sale.vehicleSaleContract?.saleValue ?? 0), 0),
    }
    return stats
  }, [sales])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return sales.filter((sale) => {
      const contract = sale.vehicleSaleContract
      if (statusFilter !== 'total' && Number(contract?.status ?? 0) !== Number(statusFilter)) return false
      if (!term) return true
      return (
        String(sale.internal_code ?? sale.code).includes(term) ||
        (contract?.buyer?.name ?? '').toLowerCase().includes(term) ||
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
      await deleteSale(session.token.token, deletedId)
      setDeleteTarget(null)
      setSales((prev) => prev.filter((sale) => sale.id !== deletedId))
      reload()
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
      await Promise.all(Array.from(selected).map((id) => deleteSale(session.token.token, id)))
      setDeletingSelected(false)
      setSales((prev) => prev.filter((sale) => !deletedIds.has(sale.id)))
      setSelected(new Set())
      reload()
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Não foi possível excluir as vendas selecionadas.')
    } finally {
      setDeleting(false)
    }
  }

  function buildRowActions(sale: SaleRecord): RowAction[] {
    return [
      {
        key: 'edit',
        label: 'Editar',
        icon: <PencilIcon className="h-4 w-4" />,
        onClick: () => onEdit(sale),
      },
      {
        key: 'contract',
        label: 'Visualizar contrato',
        icon: <PrinterIcon className="h-4 w-4" />,
        onClick: () => setContractSale(sale),
      },
      {
        key: 'delete',
        label: 'Deletar',
        icon: <TrashIcon className="h-4 w-4" />,
        tone: 'danger',
        dividerBefore: true,
        onClick: () => setDeleteTarget(sale),
      },
    ]
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Principal</p>
          <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">Venda de veículos</h1>
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

      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--card-shadow)]">
        <div className="grid grid-cols-3 divide-y divide-[var(--border)] sm:divide-x sm:divide-y-0">
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

      <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5">
        <SearchIcon className="h-4 w-4 flex-none text-[var(--muted)]" />
        <input
          type="text"
          placeholder="Buscar por código, comprador ou placa"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-full bg-transparent text-[13.5px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none"
        />
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[var(--blue-100)] px-4 py-3">
          <span className="text-[13px] font-bold text-[var(--blue-700)]">
            {selected.size} selecionado{selected.size === 1 ? '' : 's'}
          </span>
          <div className="flex items-center gap-2">
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
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-11 animate-pulse rounded-xl bg-[var(--page)]" />
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
                const contract = sale.vehicleSaleContract!
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
                        aria-label={`Selecionar venda ${sale.internal_code ?? sale.code}`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="min-w-0 truncate text-[13.5px] font-bold text-[var(--ink)]">
                            #{sale.internal_code ?? sale.code} · {contract.buyer?.name || '—'}
                          </p>
                          <span className={`flex-none rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusTone(contract.status)}`}>
                            {VEHICLE_SALE_STATUS_LABELS[contract.status] ?? '—'}
                          </span>
                        </div>
                        <p className="mt-1 flex items-center gap-1.5 truncate text-[12px] text-[var(--ink-soft)]">
                          <TruckIcon className="h-3.5 w-3.5 flex-none text-[var(--muted)]" />
                          {vehicleLabel(sale)}
                        </p>
                        <p className="mt-0.5 text-[12px] text-[var(--muted)]">
                          {paymentLabel(contract)}
                          {contract.downPayment ? ` · Entrada: ${formatCurrency(contract.downPayment)}` : ''}
                        </p>
                        <p className="mt-0.5 text-[12px] font-bold text-[var(--green-600)]">
                          Total: {formatCurrency(contract.saleValue ?? 0)}
                        </p>
                        <div className="mt-2.5 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => onEdit(sale)}
                            className="flex items-center gap-1.5 rounded-lg bg-[var(--page)] px-3 py-1.5 text-[12px] font-semibold text-[var(--ink-soft)]"
                          >
                            <PencilIcon className="h-3.5 w-3.5" />
                            Editar
                          </button>
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
                    <th className="w-[32%] px-2 pb-2.5">Comprador / Veículo</th>
                    <th className="w-[22%] px-2 pb-2.5">Pagamento</th>
                    <th className="w-[15%] px-2 pb-2.5 text-right">Valor total</th>
                    <th className="w-[11%] px-2 pb-2.5">Status</th>
                    <th className="w-10 pb-2.5 pr-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((sale, index) => {
                    const contract = sale.vehicleSaleContract!
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
                            aria-label={`Selecionar venda ${sale.internal_code ?? sale.code}`}
                          />
                        </td>
                        <td className="px-2 py-2.5">
                          <div className="flex items-start gap-2.5">
                            <span className="mt-0.5 flex-none rounded-lg bg-[var(--blue-100)] px-2 py-1 text-[11px] font-bold text-[var(--blue-700)]">
                              #{sale.internal_code ?? sale.code}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-[13.5px] font-semibold text-[var(--ink)]" title={contract.buyer?.name}>
                                {contract.buyer?.name || '—'}
                              </p>
                              <p
                                className="mt-1 flex items-center gap-1 truncate text-[12px] text-[var(--ink-soft)]"
                                title={vehicleLabel(sale)}
                              >
                                <TruckIcon className="h-3.5 w-3.5 flex-none text-[var(--muted)]" />
                                <span className="min-w-0 truncate">{vehicleLabel(sale)}</span>
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-2 py-2.5 text-[var(--ink-soft)]">
                          <p>{paymentLabel(contract)}</p>
                          {contract.downPayment ? (
                            <p className="text-[11px] text-[var(--muted)]">Entrada: {formatCurrency(contract.downPayment)}</p>
                          ) : contract.firstDueDate ? (
                            <p className="text-[11px] text-[var(--muted)]">1ª parcela: {formatDate(contract.firstDueDate)}</p>
                          ) : null}
                        </td>
                        <td className="px-2 py-2.5 text-right font-bold text-[var(--green-600)]">
                          {formatCurrency(contract.saleValue ?? 0)}
                        </td>
                        <td className="px-2 py-2.5">
                          <span className={`rounded-full px-2 py-1 text-[10.5px] font-bold leading-tight ${statusTone(contract.status)}`}>
                            {VEHICLE_SALE_STATUS_LABELS[contract.status] ?? '—'}
                          </span>
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
        message={`Tem certeza que deseja excluir a venda #${deleteTarget?.internal_code ?? deleteTarget?.code}? Essa ação não pode ser desfeita.`}
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

      {deleteError && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-[var(--red-500)] px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg">
          {deleteError}
        </div>
      )}

      <SaleContractPreviewModal
        open={Boolean(contractSale)}
        session={session}
        sale={contractSale}
        onClose={() => setContractSale(null)}
      />
    </div>
  )
}
