import { useEffect, useState } from 'react'
import {
  fetchVehicles,
  deleteVehicle,
  deleteVehiclesSelected,
  VEHICLE_ROLE_LABELS,
  VEHICLE_STATUS_LABELS,
  type VehicleRecord,
} from '../lib/vehicles'
import { ApiError } from '../lib/api'
import { getCached, setCached } from '../lib/cache'
import { useRowSelection } from '../hooks/useRowSelection'
import { SearchIcon, PlusIcon, PencilIcon, TrashIcon, PrinterIcon } from '../components/icons'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { PrintPreviewModal, type PrintColumn } from '../components/PrintPreviewModal'
import type { AuthSession, AuthCompany } from '../lib/auth'

interface VehiclesPageProps {
  session: AuthSession
  company: AuthCompany
  onCreate: () => void
  onEdit: (vehicle: VehicleRecord) => void
}

const ROLE_FILTERS: { value: number | undefined; label: string }[] = [
  { value: undefined, label: 'Todos' },
  { value: 1, label: 'Carros' },
  { value: 0, label: 'Motos' },
]

const PRINT_COLUMNS: PrintColumn[] = [
  { key: 'internalCode', label: 'Código' },
  { key: 'plate', label: 'Placa' },
  { key: 'vehicle', label: 'Veículo' },
  { key: 'year', label: 'Ano' },
  { key: 'color', label: 'Cor' },
  { key: 'fuel', label: 'Combustível' },
  { key: 'status', label: 'Status' },
]

function statusTone(status?: number[]): string {
  return (status?.[0] ?? 0) === 0
    ? 'bg-[var(--green-100)] text-[var(--green-600)]'
    : 'bg-[var(--page)] text-[var(--muted)]'
}

function vehicleLabel(vehicle: VehicleRecord): string {
  const parts = [vehicle.brand, vehicle.model].filter(Boolean)
  return parts.length ? parts.join(' ') : '—'
}

export function VehiclesPage({ session, company, onCreate, onEdit }: VehiclesPageProps) {
  const [search, setSearch] = useState('')
  const [role, setRole] = useState<number | undefined>(undefined)
  const [page, setPage] = useState(1)
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([])
  const [meta, setMeta] = useState({ total: 0, lastPage: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { selected, toggle, toggleAll, clear, setSelected } = useRowSelection()
  const [deleteTarget, setDeleteTarget] = useState<VehicleRecord | null>(null)
  const [deletingSelected, setDeletingSelected] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [printOpen, setPrintOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    const cacheKey = `vehicles:${company.id}:${role ?? 'all'}:${page}:${search}`
    const cached = getCached<{ vehicles: VehicleRecord[]; meta: typeof meta }>(cacheKey)

    if (cached) {
      setVehicles(cached.vehicles)
      setMeta(cached.meta)
      setLoading(false)
    } else {
      setLoading(true)
    }
    setError(null)

    const timeout = setTimeout(
      () => {
        fetchVehicles(session.token.token, company.id, { search, role, page, limit: 10 })
          .then((res) => {
            if (cancelled) return
            const nextVehicles = res.data || []
            const nextMeta = { total: res.meta?.total ?? res.data?.length ?? 0, lastPage: res.meta?.last_page ?? 1 }
            setVehicles(nextVehicles)
            setMeta(nextMeta)
            setCached(cacheKey, { vehicles: nextVehicles, meta: nextMeta })
            clear()
          })
          .catch((err) => {
            if (cancelled) return
            setError(err instanceof ApiError ? err.message : 'Não foi possível carregar os veículos.')
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
  }, [search, role, page, company.id, session.token.token])

  function silentReload() {
    const cacheKey = `vehicles:${company.id}:${role ?? 'all'}:${page}:${search}`
    fetchVehicles(session.token.token, company.id, { search, role, page, limit: 10 })
      .then((res) => {
        const nextVehicles = res.data || []
        const nextMeta = { total: res.meta?.total ?? res.data?.length ?? 0, lastPage: res.meta?.last_page ?? 1 }
        setVehicles(nextVehicles)
        setMeta(nextMeta)
        setCached(cacheKey, { vehicles: nextVehicles, meta: nextMeta })
      })
      .catch(() => {})
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    const deletedId = deleteTarget.id
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteVehicle(session.token.token, deletedId)
      setDeleteTarget(null)
      setVehicles((prev) => prev.filter((vehicle) => vehicle.id !== deletedId))
      setMeta((prev) => ({ ...prev, total: Math.max(0, prev.total - 1) }))
      silentReload()
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Não foi possível excluir o veículo.')
    } finally {
      setDeleting(false)
    }
  }

  async function handleConfirmDeleteSelected() {
    const deletedIds = new Set(selected)
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteVehiclesSelected(session.token.token, Array.from(selected))
      setDeletingSelected(false)
      setVehicles((prev) => prev.filter((vehicle) => !deletedIds.has(vehicle.id)))
      setMeta((prev) => ({ ...prev, total: Math.max(0, prev.total - deletedIds.size) }))
      setSelected(new Set())
      silentReload()
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Não foi possível excluir os veículos selecionados.')
    } finally {
      setDeleting(false)
    }
  }

  const selectedVehicles = vehicles.filter((vehicle) => selected.has(vehicle.id))
  const printRows = selectedVehicles.map((vehicle) => ({
    internalCode: vehicle.internal_code != null ? `#${vehicle.internal_code}` : '—',
    plate: vehicle.license_plate,
    vehicle: vehicleLabel(vehicle),
    year: vehicle.model_year || '—',
    color: vehicle.color || '—',
    fuel: vehicle.fuel || '—',
    status: VEHICLE_STATUS_LABELS[vehicle.status?.[0] ?? 0] ?? '—',
  }))

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Cadastros</p>
          <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">Veículos</h1>
        </div>
        <button
          type="button"
          onClick={onCreate}
          className="flex items-center gap-2 rounded-xl bg-[var(--blue-500)] px-4 py-2.5 text-[13.5px] font-bold text-white transition hover:bg-[var(--blue-700)]"
        >
          <PlusIcon className="h-4 w-4" />
          Novo veículo
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5">
          <SearchIcon className="h-4 w-4 flex-none text-[var(--muted)]" />
          <input
            type="text"
            placeholder="Buscar por placa, marca ou modelo"
            value={search}
            onChange={(event) => {
              setPage(1)
              setSearch(event.target.value)
            }}
            className="w-full bg-transparent text-[13.5px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none"
          />
        </div>

        <div className="flex gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1">
          {ROLE_FILTERS.map((option) => (
            <button
              key={option.label}
              type="button"
              onClick={() => {
                setPage(1)
                setRole(option.value)
              }}
              className={`rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition ${
                role === option.value ? 'bg-[var(--blue-500)] text-white' : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'
              }`}
            >
              {option.label}
            </button>
          ))}
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
        ) : vehicles.length === 0 ? (
          <p className="py-10 text-center text-[13.5px] text-[var(--muted)]">
            Nenhum veículo encontrado{search ? ` para "${search}"` : ''}.
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-2.5 sm:hidden">
              {vehicles.map((vehicle) => (
                <div
                  key={vehicle.id}
                  className={`rounded-xl border border-[var(--border)] p-3 ${
                    selected.has(vehicle.id) ? 'bg-[var(--blue-100)]' : 'bg-[var(--surface)]'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      checked={selected.has(vehicle.id)}
                      onChange={() => toggle(vehicle.id)}
                      className="mt-0.5 h-4 w-4 flex-none accent-[var(--blue-500)]"
                      aria-label={`Selecionar ${vehicle.license_plate}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 truncate font-mono text-[13.5px] font-bold text-[var(--ink)]">
                          {vehicle.license_plate}
                        </p>
                        <span
                          className={`flex-none rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusTone(vehicle.status)}`}
                        >
                          {VEHICLE_STATUS_LABELS[vehicle.status?.[0] ?? 0] ?? '—'}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[12px] text-[var(--ink-soft)]">{vehicleLabel(vehicle)}</p>
                      <p className="text-[12px] text-[var(--muted)]">
                        {vehicle.internal_code != null ? `#${vehicle.internal_code}` : '—'}
                        {vehicle.model_year ? ` · ${vehicle.model_year}` : ''}
                        {vehicle.color ? ` · ${vehicle.color}` : ''}
                        {vehicle.fuel ? ` · ${vehicle.fuel}` : ''}
                        {' · '}
                        {VEHICLE_ROLE_LABELS[vehicle.role ?? 1]}
                      </p>
                      <div className="mt-2.5 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onEdit(vehicle)}
                          className="flex items-center gap-1.5 rounded-lg bg-[var(--page)] px-3 py-1.5 text-[12px] font-semibold text-[var(--ink-soft)]"
                        >
                          <PencilIcon className="h-3.5 w-3.5" />
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(vehicle)}
                          className="flex items-center gap-1.5 rounded-lg bg-[var(--red-100)] px-3 py-1.5 text-[12px] font-semibold text-[var(--red-500)]"
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                          Excluir
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                    <th className="w-10 pb-2.5 pl-3">
                      <input
                        type="checkbox"
                        checked={vehicles.length > 0 && selected.size === vehicles.length}
                        onChange={() => toggleAll(vehicles.map((v) => v.id))}
                        className="h-4 w-4 accent-[var(--blue-500)]"
                        aria-label="Selecionar todos"
                      />
                    </th>
                    <th className="pb-2.5">Código</th>
                    <th className="pb-2.5">Placa</th>
                    <th className="pb-2.5">Veículo</th>
                    <th className="pb-2.5">Ano</th>
                    <th className="pb-2.5">Cor</th>
                    <th className="pb-2.5">Combustível</th>
                    <th className="pb-2.5">Tipo</th>
                    <th className="pb-2.5">Status</th>
                    <th className="pb-2.5 pr-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {vehicles.map((vehicle, index) => (
                    <tr
                      key={vehicle.id}
                      className={`border-b border-[var(--border)] transition-colors last:border-none hover:bg-[var(--blue-100)] ${
                        index % 2 === 1 ? 'bg-[var(--page)]' : ''
                      } ${selected.has(vehicle.id) ? 'bg-[var(--blue-100)]' : ''}`}
                    >
                      <td className="py-2.5 pl-3">
                        <input
                          type="checkbox"
                          checked={selected.has(vehicle.id)}
                          onChange={() => toggle(vehicle.id)}
                          className="h-4 w-4 accent-[var(--blue-500)]"
                          aria-label={`Selecionar ${vehicle.license_plate}`}
                        />
                      </td>
                      <td className="py-2.5 font-mono text-[var(--ink-soft)]">
                        {vehicle.internal_code != null ? `#${vehicle.internal_code}` : '—'}
                      </td>
                      <td className="py-2.5 font-mono font-medium text-[var(--ink)]">{vehicle.license_plate}</td>
                      <td className="py-2.5 text-[var(--ink-soft)]">{vehicleLabel(vehicle)}</td>
                      <td className="py-2.5 text-[var(--ink-soft)]">{vehicle.model_year || '—'}</td>
                      <td className="py-2.5 text-[var(--ink-soft)]">{vehicle.color || '—'}</td>
                      <td className="py-2.5 text-[var(--ink-soft)]">{vehicle.fuel || '—'}</td>
                      <td className="py-2.5 text-[var(--ink-soft)]">{VEHICLE_ROLE_LABELS[vehicle.role ?? 1]}</td>
                      <td className="py-2.5">
                        <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase ${statusTone(vehicle.status)}`}>
                          {VEHICLE_STATUS_LABELS[vehicle.status?.[0] ?? 0] ?? '—'}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => onEdit(vehicle)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--ink)]"
                            aria-label="Editar"
                          >
                            <PencilIcon className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(vehicle)}
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
          </>
        )}

        {!loading && meta.lastPage > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-[12px] text-[var(--muted)]">{meta.total} veículos no total</p>
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
        title="Excluir veículo"
        message={`Tem certeza que deseja excluir a placa "${deleteTarget?.license_plate}"? Essa ação não pode ser desfeita.`}
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
        message={`Tem certeza que deseja excluir ${selected.size} veículo${selected.size === 1 ? '' : 's'}? Essa ação não pode ser desfeita.`}
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
        title="Veículos"
        subtitle={`${company.people?.name ?? ''} · ${printRows.length} registro${printRows.length === 1 ? '' : 's'}`}
        columns={PRINT_COLUMNS}
        rows={printRows}
        onClose={() => setPrintOpen(false)}
      />
    </div>
  )
}
