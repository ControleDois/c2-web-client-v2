import { useEffect, useMemo, useState } from 'react'
import {
  fetchSales,
  deleteSale,
  RENTAL_FREQUENCY_LABELS,
  VEHICLE_RENTAL_STATUS_LABELS,
  type SaleRecord,
  type VehicleRentalContractRecord,
} from '../lib/sales'
import { formatCurrency, formatDate } from '../lib/format'
import { ApiError } from '../lib/api'
import { getCached, setCached } from '../lib/cache'
import { useRowSelection } from '../hooks/useRowSelection'
import { SearchIcon, PlusIcon, PencilIcon, TrashIcon, PrinterIcon, TruckIcon } from '../components/icons'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { RowActionsMenu, type RowAction } from '../components/RowActionsMenu'
import { SaleContractPreviewModal } from '../components/SaleContractPreviewModal'
import { ListEntityDateFilters, type EntityPick } from '../components/ListEntityDateFilters'
import type { AuthSession, AuthCompany } from '../lib/auth'

function periodOverlaps(startDate: string | null | undefined, endDate: string | null | undefined, from: string, to: string): boolean {
  const start = startDate ? startDate.slice(0, 10) : undefined
  const end = endDate ? endDate.slice(0, 10) : undefined
  if (from && end && end < from) return false
  if (to && start && start > to) return false
  return true
}

interface VehicleRentalsPageProps {
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
  { key: '1', status: 1, label: 'Retirados', barVar: '--blue-500', textVar: '--blue-700' },
  { key: '2', status: 2, label: 'Devolvidos', barVar: '--green-600', textVar: '--green-600' },
]

function statusTone(status: number): string {
  if (status === 2) return 'bg-[var(--green-100)] text-[var(--green-600)]'
  if (status === 1) return 'bg-[var(--blue-100)] text-[var(--blue-700)]'
  return 'bg-[var(--amber-100)] text-[var(--amber-500)]'
}

function vehicleLabel(sale: SaleRecord): string {
  const parts = [sale.vehicle?.brand, sale.vehicle?.model].filter(Boolean)
  return parts.length ? parts.join(' ') : sale.vehicle?.license_plate || '—'
}

function frequencyLabel(frequency?: string | null): string {
  if (!frequency) return '—'
  return RENTAL_FREQUENCY_LABELS[frequency] ?? frequency
}

function rentalUnits(contract: VehicleRentalContractRecord): number | null {
  if (!contract.startDate || !contract.endDate) return null
  const start = new Date(contract.startDate)
  const end = new Date(contract.endDate)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return null

  const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))

  if (contract.rentalFrequency === 'daily') {
    return Math.max(1, diffDays)
  }
  if (contract.rentalFrequency === 'weekly') {
    return Math.max(1, Math.ceil(diffDays / 7))
  }
  // monthly (padrão)
  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
  if (end.getDate() < start.getDate()) months -= 1
  return Math.max(1, months)
}

function rentalUnitsLabel(frequency: string | undefined, units: number): string {
  if (frequency === 'daily') return `${units} ${units === 1 ? 'diária' : 'diárias'}`
  if (frequency === 'weekly') return `${units} ${units === 1 ? 'semana' : 'semanas'}`
  return `${units} ${units === 1 ? 'mês' : 'meses'}`
}

// Em aluguel com opção de compra o valor pago por período é a parcela do
// financiamento do veículo (valor total / nº de parcelas), não o monthlyValue
// bruto — que nesses contratos costuma guardar o valor total do veículo.
function rentalPeriodValue(contract: VehicleRentalContractRecord): number | null {
  if (contract.purchaseOption) {
    if (!contract.vehicleTotalValue || !contract.installmentCount) return null
    return contract.vehicleTotalValue / contract.installmentCount
  }
  return contract.monthlyValue ?? null
}

function rentalTotalValue(contract: VehicleRentalContractRecord): number | null {
  if (contract.purchaseOption) {
    return contract.vehicleTotalValue ?? null
  }
  const units = rentalUnits(contract)
  if (units === null || !contract.monthlyValue) return null
  return units * contract.monthlyValue
}

export function VehicleRentalsPage({ session, company, onCreate, onEdit }: VehicleRentalsPageProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('total')
  const [vehicleFilter, setVehicleFilter] = useState<EntityPick | null>(null)
  const [personFilter, setPersonFilter] = useState<EntityPick | null>(null)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
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
    const cacheKey = `vehicle-rentals:${company.id}`
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
        const rentals = (res.data || []).filter((sale) => sale.vehicleRentalContract)
        setSales(rentals)
        setCached(cacheKey, rentals)
        clear()
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof ApiError ? err.message : 'Não foi possível carregar os aluguéis.')
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
  }, [search, statusFilter, vehicleFilter, personFilter, dateFrom, dateTo])

  function reload() {
    fetchSales(session.token.token, company.id, { limit: 500 })
      .then((res) => {
        const rentals = (res.data || []).filter((sale) => sale.vehicleRentalContract)
        setSales(rentals)
        setCached(`vehicle-rentals:${company.id}`, rentals)
      })
      .catch(() => {})
  }

  const bucketStats = useMemo(() => {
    const stats: Record<string, { count: number; total: number }> = {}
    for (const bucket of STATUS_BUCKETS) {
      const matching = sales.filter((sale) => Number(sale.vehicleRentalContract?.status ?? 0) === bucket.status)
      stats[bucket.key] = {
        count: matching.length,
        total: matching.reduce((sum, sale) => sum + (sale.vehicleRentalContract ? rentalPeriodValue(sale.vehicleRentalContract) ?? 0 : 0), 0),
      }
    }
    stats.total = {
      count: sales.length,
      total: sales.reduce((sum, sale) => sum + (sale.vehicleRentalContract ? rentalPeriodValue(sale.vehicleRentalContract) ?? 0 : 0), 0),
    }
    return stats
  }, [sales])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return sales.filter((sale) => {
      const contract = sale.vehicleRentalContract
      if (statusFilter !== 'total' && Number(contract?.status ?? 0) !== Number(statusFilter)) return false
      if (vehicleFilter && sale.vehicle?.id !== vehicleFilter.id) return false
      if (personFilter && contract?.renter?.id !== personFilter.id) return false
      if ((dateFrom || dateTo) && !periodOverlaps(contract?.startDate, contract?.endDate, dateFrom, dateTo)) return false
      if (!term) return true
      return (
        String(sale.internal_code ?? sale.code).includes(term) ||
        (contract?.renter?.name ?? '').toLowerCase().includes(term) ||
        (sale.vehicle?.license_plate ?? '').toLowerCase().includes(term)
      )
    })
  }, [sales, search, statusFilter, vehicleFilter, personFilter, dateFrom, dateTo])

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
      setDeleteError(err instanceof ApiError ? err.message : 'Não foi possível excluir o aluguel.')
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
      setDeleteError(err instanceof ApiError ? err.message : 'Não foi possível excluir os aluguéis selecionados.')
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
          <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">Aluguel de veículos</h1>
        </div>
        <button
          type="button"
          onClick={onCreate}
          className="flex items-center gap-2 rounded-xl bg-[var(--blue-500)] px-4 py-2.5 text-[13.5px] font-bold text-white transition hover:bg-[var(--blue-700)]"
        >
          <PlusIcon className="h-4 w-4" />
          Novo aluguel
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--card-shadow)]">
        <div className="grid grid-cols-2 divide-y divide-[var(--border)] sm:grid-cols-4 sm:divide-x sm:divide-y-0">
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
          placeholder="Buscar por código, locatário ou placa"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-full bg-transparent text-[13.5px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none"
        />
      </div>

      <ListEntityDateFilters
        session={session}
        company={company}
        vehicle={vehicleFilter}
        onVehicleChange={setVehicleFilter}
        person={personFilter}
        onPersonChange={setPersonFilter}
        personLabel="Locatário"
        dateFrom={dateFrom}
        onDateFromChange={setDateFrom}
        dateTo={dateTo}
        onDateToChange={setDateTo}
      />

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
            Nenhum aluguel encontrado{search ? ` para "${search}"` : ''}.
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-2.5 sm:hidden">
              {visible.map((sale) => {
                const contract = sale.vehicleRentalContract!
                const units = rentalUnits(contract)
                const periodValue = rentalPeriodValue(contract)
                const total = rentalTotalValue(contract)
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
                        aria-label={`Selecionar aluguel ${sale.internal_code ?? sale.code}`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="min-w-0 truncate text-[13.5px] font-bold text-[var(--ink)]">
                            #{sale.internal_code ?? sale.code} · {contract.renter?.name || '—'}
                          </p>
                          <span className={`flex-none rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusTone(contract.status)}`}>
                            {VEHICLE_RENTAL_STATUS_LABELS[contract.status] ?? '—'}
                          </span>
                        </div>
                        <p className="mt-1 flex items-center gap-1.5 truncate text-[12px] text-[var(--ink-soft)]">
                          <TruckIcon className="h-3.5 w-3.5 flex-none text-[var(--muted)]" />
                          {vehicleLabel(sale)}
                        </p>
                        <p className="mt-0.5 text-[12px] text-[var(--muted)]">
                          {contract.startDate ? formatDate(contract.startDate) : '—'}
                          {contract.endDate ? ` – ${formatDate(contract.endDate)}` : ''}
                          {units !== null ? ` (${rentalUnitsLabel(contract.rentalFrequency, units)})` : ''}
                        </p>
                        <p className="mt-0.5 text-[12px] text-[var(--muted)]">
                          {contract.purchaseOption ? 'Parcela' : frequencyLabel(contract.rentalFrequency)}:{' '}
                          {periodValue !== null ? formatCurrency(periodValue) : '—'}
                          {total !== null && (
                            <>
                              {' · '}
                              <span className="font-bold text-[var(--green-600)]">Total: {formatCurrency(total)}</span>
                            </>
                          )}
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
                    <th className="w-[32%] px-2 pb-2.5">Locatário / Veículo</th>
                    <th className="w-[18%] px-2 pb-2.5">Período</th>
                    <th className="w-[13%] px-2 pb-2.5 text-right">Valor</th>
                    <th className="w-[13%] px-2 pb-2.5 text-right">Valor total</th>
                    <th className="w-[11%] px-2 pb-2.5">Status</th>
                    <th className="w-10 pb-2.5 pr-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((sale, index) => {
                    const contract = sale.vehicleRentalContract!
                    const units = rentalUnits(contract)
                    const periodValue = rentalPeriodValue(contract)
                    const total = rentalTotalValue(contract)
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
                            aria-label={`Selecionar aluguel ${sale.internal_code ?? sale.code}`}
                          />
                        </td>
                        <td className="px-2 py-2.5">
                          <div className="flex items-start gap-2.5">
                            <span className="mt-0.5 flex-none rounded-lg bg-[var(--blue-100)] px-2 py-1 text-[11px] font-bold text-[var(--blue-700)]">
                              #{sale.internal_code ?? sale.code}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-[13.5px] font-semibold text-[var(--ink)]" title={contract.renter?.name}>
                                {contract.renter?.name || '—'}
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
                          <p>
                            {contract.startDate ? formatDate(contract.startDate) : '—'}
                            {contract.endDate ? ` – ${formatDate(contract.endDate)}` : ''}
                          </p>
                          {units !== null && (
                            <p className="text-[11px] text-[var(--muted)]">
                              {rentalUnitsLabel(contract.rentalFrequency, units)}
                            </p>
                          )}
                        </td>
                        <td className="px-2 py-2.5 text-right font-semibold text-[var(--ink)]">
                          {periodValue !== null ? formatCurrency(periodValue) : '—'}
                          <span className="ml-1 text-[11px] font-normal text-[var(--muted)]">
                            {contract.purchaseOption ? '/parcela' : contract.rentalFrequency ? `/${frequencyLabel(contract.rentalFrequency).toLowerCase()}` : ''}
                          </span>
                        </td>
                        <td className="px-2 py-2.5 text-right font-bold text-[var(--green-600)]">
                          {total !== null ? formatCurrency(total) : '—'}
                        </td>
                        <td className="px-2 py-2.5">
                          <span className={`rounded-full px-2 py-1 text-[10.5px] font-bold leading-tight ${statusTone(contract.status)}`}>
                            {VEHICLE_RENTAL_STATUS_LABELS[contract.status] ?? '—'}
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
            <p className="text-[12px] text-[var(--muted)]">{filtered.length} aluguéis no total</p>
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
        title="Excluir aluguel"
        message={`Tem certeza que deseja excluir o aluguel #${deleteTarget?.internal_code ?? deleteTarget?.code}? Essa ação não pode ser desfeita.`}
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
        title="Excluir selecionados"
        message={`Tem certeza que deseja excluir ${selected.size} aluguel${selected.size === 1 ? '' : 'éis'}? Essa ação não pode ser desfeita.`}
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
