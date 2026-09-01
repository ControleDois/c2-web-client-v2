import { useEffect, useMemo, useState } from 'react'
import {
  fetchOrderServices,
  deleteOrderService,
  ORDER_SERVICE_STATUS_LABELS,
  type OrderServiceRecord,
} from '../lib/orderServices'
import { formatCurrency, formatDate } from '../lib/format'
import { ApiError } from '../lib/api'
import { useRowSelection } from '../hooks/useRowSelection'
import { SearchIcon, PlusIcon, PencilIcon, TrashIcon, TruckIcon, PrinterIcon } from '../components/icons'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { RowActionsMenu, type RowAction } from '../components/RowActionsMenu'
import { ListEntityDateFilters, type EntityPick } from '../components/ListEntityDateFilters'
import { PrintPreviewModal, type PrintColumn } from '../components/PrintPreviewModal'
import type { AuthSession, AuthCompany } from '../lib/auth'

const PRINT_COLUMNS_COMPLETE: PrintColumn[] = [
  { key: 'tipo', label: 'Tipo' },
  { key: 'description', label: 'Peça/Serviço' },
  { key: 'cost', label: 'Custo', align: 'right' },
  { key: 'margin', label: 'Margem', align: 'right' },
  { key: 'qty', label: 'Qtd.', align: 'right' },
  { key: 'value', label: 'Valor', align: 'right' },
]

const PRINT_COLUMNS_SUMMARY: PrintColumn[] = [
  { key: 'tipo', label: 'Tipo' },
  { key: 'description', label: 'Peça/Serviço' },
  { key: 'qty', label: 'Qtd.', align: 'right' },
  { key: 'value', label: 'Valor', align: 'right' },
]

interface OrderServicesPageProps {
  session: AuthSession
  company: AuthCompany
  onCreate: () => void
  onEdit: (orderService: OrderServiceRecord) => void
}

const PAGE_SIZE = 10

function statusTone(status: number): string {
  if (status >= 6) return 'bg-[var(--green-100)] text-[var(--green-600)]'
  if (status >= 4) return 'bg-[var(--blue-100)] text-[var(--blue-700)]'
  return 'bg-[var(--amber-100)] text-[var(--amber-500)]'
}

function vehicleLabel(orderService: OrderServiceRecord): string {
  const modelParts = [orderService.vehicle?.brand, orderService.vehicle?.model].filter(Boolean)
  const model = modelParts.join(' ')
  const plate = orderService.vehicle?.license_plate
  if (model && plate) return `${model} · ${plate}`
  return model || plate || '—'
}

function orderServiceTotal(orderService: OrderServiceRecord): number {
  return (orderService.items ?? []).reduce((sum, item) => sum + Number(item.total || 0), 0)
}

function currentMonthRange(): { from: string; to: string } {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)
  return { from, to }
}

export function OrderServicesPage({ session, company, onCreate, onEdit }: OrderServicesPageProps) {
  const [search, setSearch] = useState('')
  const [{ from: defaultFrom, to: defaultTo }] = useState(currentMonthRange)
  const [dateFrom, setDateFrom] = useState(defaultFrom)
  const [dateTo, setDateTo] = useState(defaultTo)
  const [vehicleFilter, setVehicleFilter] = useState<EntityPick | null>(null)
  const [personFilter, setPersonFilter] = useState<EntityPick | null>(null)
  const [statusFilter, setStatusFilter] = useState('total')
  const [page, setPage] = useState(1)
  const [orderServices, setOrderServices] = useState<OrderServiceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { selected, toggle, toggleAll, clear, setSelected } = useRowSelection()
  const [deleteTarget, setDeleteTarget] = useState<OrderServiceRecord | null>(null)
  const [deletingSelected, setDeletingSelected] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [printTarget, setPrintTarget] = useState<OrderServiceRecord | null>(null)
  const [printMode, setPrintMode] = useState<'complete' | 'summary'>('complete')

  const fetchOptions = {
    limit: 500,
    dateStart: dateFrom || undefined,
    dateEnd: dateTo || undefined,
    vehicleId: vehicleFilter?.id,
    peopleId: personFilter?.id,
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    fetchOrderServices(session.token.token, company.id, fetchOptions)
      .then((res) => {
        if (cancelled) return
        setOrderServices(res.data || [])
        clear()
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof ApiError ? err.message : 'Não foi possível carregar as ordens de serviço.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company.id, session.token.token, dateFrom, dateTo, vehicleFilter, personFilter])

  useEffect(() => {
    setPage(1)
  }, [search, statusFilter, dateFrom, dateTo, vehicleFilter, personFilter])

  function reload() {
    fetchOrderServices(session.token.token, company.id, fetchOptions)
      .then((res) => setOrderServices(res.data || []))
      .catch(() => {})
  }

  const bucketStats = useMemo(() => {
    const open = orderServices.filter((os) => os.status < 6)
    const finished = orderServices.filter((os) => os.status >= 6)
    return {
      open: { count: open.length, total: open.reduce((sum, os) => sum + orderServiceTotal(os), 0) },
      finished: { count: finished.length, total: finished.reduce((sum, os) => sum + orderServiceTotal(os), 0) },
      total: { count: orderServices.length, total: orderServices.reduce((sum, os) => sum + orderServiceTotal(os), 0) },
    }
  }, [orderServices])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return orderServices.filter((os) => {
      if (statusFilter === 'open' && os.status >= 6) return false
      if (statusFilter === 'finished' && os.status < 6) return false
      if (!term) return true
      return (
        String(os.code ?? '').includes(term) ||
        (os.people?.name ?? '').toLowerCase().includes(term) ||
        (os.vehicle?.license_plate ?? '').toLowerCase().includes(term)
      )
    })
  }, [orderServices, search, statusFilter])

  const lastPage = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const printRows = useMemo(() => {
    if (!printTarget) return []
    return (printTarget.items ?? []).map((item) => {
      const cost = Number(item.purchase_cost || 0)
      const value = Number(item.cost_value || 0)
      const margin = cost > 0 ? ((value - cost) / cost) * 100 : 0
      return {
        tipo: item.product?.role === 1 ? 'Serviço' : 'Peça',
        description: item.description || item.product?.name || '—',
        supplier: item.supplier?.name || 'Não informado',
        note: item.note || 'Não informado',
        cost: formatCurrency(cost),
        margin: `${margin.toFixed(1)}%`,
        qty: String(item.amount),
        value: formatCurrency(Number(item.total || 0)),
      }
    })
  }, [printTarget])

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    const deletedId = deleteTarget.id
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteOrderService(session.token.token, deletedId)
      setDeleteTarget(null)
      setOrderServices((prev) => prev.filter((os) => os.id !== deletedId))
      reload()
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Não foi possível excluir a OS.')
    } finally {
      setDeleting(false)
    }
  }

  async function handleConfirmDeleteSelected() {
    const deletedIds = new Set(selected)
    setDeleting(true)
    setDeleteError(null)
    try {
      await Promise.all(Array.from(selected).map((id) => deleteOrderService(session.token.token, id)))
      setDeletingSelected(false)
      setOrderServices((prev) => prev.filter((os) => !deletedIds.has(os.id)))
      setSelected(new Set())
      reload()
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Não foi possível excluir as OS selecionadas.')
    } finally {
      setDeleting(false)
    }
  }

  function buildRowActions(orderService: OrderServiceRecord): RowAction[] {
    return [
      {
        key: 'edit',
        label: 'Editar',
        icon: <PencilIcon className="h-4 w-4" />,
        onClick: () => onEdit(orderService),
      },
      {
        key: 'print-complete',
        label: 'Imprimir completo',
        icon: <PrinterIcon className="h-4 w-4" />,
        onClick: () => {
          setPrintMode('complete')
          setPrintTarget(orderService)
        },
      },
      {
        key: 'print-summary',
        label: 'Imprimir resumido',
        icon: <PrinterIcon className="h-4 w-4" />,
        onClick: () => {
          setPrintMode('summary')
          setPrintTarget(orderService)
        },
      },
      {
        key: 'delete',
        label: 'Deletar',
        icon: <TrashIcon className="h-4 w-4" />,
        tone: 'danger',
        dividerBefore: true,
        onClick: () => setDeleteTarget(orderService),
      },
    ]
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Principal</p>
          <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">Ordens de serviço</h1>
        </div>
        <button
          type="button"
          onClick={onCreate}
          className="flex items-center gap-2 rounded-xl bg-[var(--blue-500)] px-4 py-2.5 text-[13.5px] font-bold text-white transition hover:bg-[var(--blue-700)]"
        >
          <PlusIcon className="h-4 w-4" />
          Nova OS
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--card-shadow)]">
        <div className="grid grid-cols-3 divide-y divide-[var(--border)] sm:divide-x sm:divide-y-0">
          <button
            type="button"
            onClick={() => setStatusFilter('open')}
            className={`relative py-5 text-center transition-all duration-300 hover:bg-[var(--page)] ${
              statusFilter !== 'total' && statusFilter !== 'open' ? 'opacity-40' : ''
            }`}
          >
            <span
              className="absolute left-0 right-0 top-0 bg-[var(--amber-500)] transition-all duration-300"
              style={{ height: statusFilter === 'open' ? 6 : 0 }}
            />
            <dt className="text-[12px] font-semibold text-[var(--muted)]">Em aberto ({bucketStats.open.count})</dt>
            <dd className="mt-1 text-[17px] font-bold tracking-tight text-[var(--amber-500)]">
              {formatCurrency(bucketStats.open.total)}
            </dd>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('finished')}
            className={`relative py-5 text-center transition-all duration-300 hover:bg-[var(--page)] ${
              statusFilter !== 'total' && statusFilter !== 'finished' ? 'opacity-40' : ''
            }`}
          >
            <span
              className="absolute left-0 right-0 top-0 bg-[var(--green-600)] transition-all duration-300"
              style={{ height: statusFilter === 'finished' ? 6 : 0 }}
            />
            <dt className="text-[12px] font-semibold text-[var(--muted)]">Finalizadas ({bucketStats.finished.count})</dt>
            <dd className="mt-1 text-[17px] font-bold tracking-tight text-[var(--green-600)]">
              {formatCurrency(bucketStats.finished.total)}
            </dd>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('total')}
            className="relative py-5 text-center transition-all duration-300 hover:bg-[var(--page)]"
          >
            <span
              className="absolute left-0 right-0 top-0 bg-[var(--ink)] transition-all duration-300"
              style={{ height: statusFilter === 'total' ? 6 : 0 }}
            />
            <dt className="text-[12px] font-semibold text-[var(--muted)]">Total ({bucketStats.total.count})</dt>
            <dd className="mt-1 text-[17px] font-bold tracking-tight text-[var(--ink)]">
              {formatCurrency(bucketStats.total.total)}
            </dd>
          </button>
        </div>
      </div>

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

      <ListEntityDateFilters
        session={session}
        company={company}
        vehicle={vehicleFilter}
        onVehicleChange={setVehicleFilter}
        person={personFilter}
        onPersonChange={setPersonFilter}
        personLabel="Cliente"
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
            Nenhuma OS encontrada{search ? ` para "${search}"` : ''}.
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-2.5 sm:hidden">
              {visible.map((os) => (
                <div
                  key={os.id}
                  className={`rounded-xl border border-[var(--border)] p-3 ${
                    selected.has(os.id) ? 'bg-[var(--blue-100)]' : 'bg-[var(--surface)]'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      checked={selected.has(os.id)}
                      onChange={() => toggle(os.id)}
                      className="mt-0.5 h-4 w-4 flex-none accent-[var(--blue-500)]"
                      aria-label={`Selecionar OS ${os.code}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 truncate text-[13.5px] font-bold text-[var(--ink)]">
                          #{os.code} · {os.people?.name || '—'}
                        </p>
                        <span className={`flex-none rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusTone(os.status)}`}>
                          {ORDER_SERVICE_STATUS_LABELS[os.status] ?? '—'}
                        </span>
                      </div>
                      <p className="mt-1 flex items-center gap-1.5 truncate text-[12px] text-[var(--ink-soft)]">
                        <TruckIcon className="h-3.5 w-3.5 flex-none text-[var(--muted)]" />
                        {vehicleLabel(os)}
                      </p>
                      <p className="mt-0.5 text-[12px] text-[var(--muted)]">
                        {os.date_start ? formatDate(os.date_start) : '—'} ·{' '}
                        <span className="font-bold text-[var(--green-600)]">{formatCurrency(orderServiceTotal(os))}</span>
                      </p>
                      <div className="mt-2.5 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => onEdit(os)}
                          className="flex items-center gap-1.5 rounded-lg bg-[var(--page)] px-3 py-1.5 text-[12px] font-semibold text-[var(--ink-soft)]"
                        >
                          <PencilIcon className="h-3.5 w-3.5" />
                          Editar
                        </button>
                        <RowActionsMenu actions={buildRowActions(os)} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full table-fixed border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                    <th className="w-10 pb-2.5 pl-3">
                      <input
                        type="checkbox"
                        checked={visible.length > 0 && visible.every((os) => selected.has(os.id))}
                        onChange={() => toggleAll(visible.map((os) => os.id))}
                        className="h-4 w-4 accent-[var(--blue-500)]"
                        aria-label="Selecionar todos"
                      />
                    </th>
                    <th className="w-[34%] px-2 pb-2.5">Cliente / Veículo</th>
                    <th className="w-[16%] px-2 pb-2.5">Data de início</th>
                    <th className="w-[16%] px-2 pb-2.5 text-right">Total</th>
                    <th className="w-[18%] px-2 pb-2.5">Status</th>
                    <th className="w-10 pb-2.5 pr-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((os, index) => (
                    <tr
                      key={os.id}
                      className={`border-b border-[var(--border)] align-top transition-colors last:border-none hover:bg-[var(--blue-100)] ${
                        index % 2 === 1 ? 'bg-[var(--page)]' : ''
                      } ${selected.has(os.id) ? 'bg-[var(--blue-100)]' : ''}`}
                    >
                      <td className="py-2.5 pl-3">
                        <input
                          type="checkbox"
                          checked={selected.has(os.id)}
                          onChange={() => toggle(os.id)}
                          className="h-4 w-4 accent-[var(--blue-500)]"
                          aria-label={`Selecionar OS ${os.code}`}
                        />
                      </td>
                      <td className="px-2 py-2.5">
                        <div className="flex items-start gap-2.5">
                          <span className="mt-0.5 flex-none rounded-lg bg-[var(--blue-100)] px-2 py-1 text-[11px] font-bold text-[var(--blue-700)]">
                            #{os.code}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-[13.5px] font-semibold text-[var(--ink)]" title={os.people?.name ?? undefined}>
                              {os.people?.name || '—'}
                            </p>
                            <p
                              className="mt-1 flex items-center gap-1 truncate text-[12px] text-[var(--ink-soft)]"
                              title={vehicleLabel(os)}
                            >
                              <TruckIcon className="h-3.5 w-3.5 flex-none text-[var(--muted)]" />
                              <span className="min-w-0 truncate">{vehicleLabel(os)}</span>
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-2.5 text-[var(--ink-soft)]">{os.date_start ? formatDate(os.date_start) : '—'}</td>
                      <td className="px-2 py-2.5 text-right font-bold text-[var(--green-600)]">
                        {formatCurrency(orderServiceTotal(os))}
                      </td>
                      <td className="px-2 py-2.5">
                        <span className={`rounded-full px-2 py-1 text-[10.5px] font-bold leading-tight ${statusTone(os.status)}`}>
                          {ORDER_SERVICE_STATUS_LABELS[os.status] ?? '—'}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-right">
                        <div className="flex items-center justify-end">
                          <RowActionsMenu actions={buildRowActions(os)} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {!loading && lastPage > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-[12px] text-[var(--muted)]">{filtered.length} OS no total</p>
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
        title="Excluir OS"
        message={`Tem certeza que deseja excluir a OS #${deleteTarget?.code}? Essa ação não pode ser desfeita.`}
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
        message={`Tem certeza que deseja excluir ${selected.size} OS? Essa ação não pode ser desfeita.`}
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
        open={Boolean(printTarget)}
        company={company}
        title={`OS #${printTarget?.code ?? ''}`}
        subtitle={`${printTarget?.people?.name ?? ''} · ${printMode === 'summary' ? 'Resumido' : 'Completo'}`}
        headerDetails={
          printMode === 'summary' || !printTarget
            ? undefined
            : [
                { label: 'Veículo', value: vehicleLabel(printTarget) },
                { label: 'Descrição do serviço', value: printTarget.note_service || printTarget.reportedProblem || '' },
              ]
        }
        columns={printMode === 'summary' ? PRINT_COLUMNS_SUMMARY : PRINT_COLUMNS_COMPLETE}
        rows={printRows}
        rowDetail={
          printMode === 'summary'
            ? undefined
            : (row) => (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '4px 24px',
                    marginTop: 2,
                    padding: '6px 10px',
                    borderRadius: 8,
                    background: '#f9fafb',
                    fontSize: 11.5,
                    color: '#6b7280',
                  }}
                >
                  <span>
                    <span style={{ color: '#374151', fontWeight: 700, textTransform: 'uppercase', fontSize: 10, letterSpacing: 0.3 }}>
                      Fornecedor
                    </span>{' '}
                    · {row.supplier}
                  </span>
                  <span>
                    <span style={{ color: '#374151', fontWeight: 700, textTransform: 'uppercase', fontSize: 10, letterSpacing: 0.3 }}>
                      Observação
                    </span>{' '}
                    · {row.note}
                  </span>
                </div>
              )
        }
        onClose={() => setPrintTarget(null)}
      />
    </div>
  )
}
