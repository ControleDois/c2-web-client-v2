import { useEffect, useState } from 'react'
import { fetchSales, RENTAL_FREQUENCY_LABELS, VEHICLE_RENTAL_STATUS_LABELS, type SaleRecord } from '../lib/sales'
import { fetchConfig } from '../lib/config'
import { ApiError } from '../lib/api'
import { formatCurrency } from '../lib/format'
import { formatDocument } from '../lib/formatDocument'
import { SearchIcon, RouteIcon } from '../components/icons'
import { RentalOperationModal, type OperationMode } from '../components/RentalOperationModal'
import type { AuthSession, AuthCompany } from '../lib/auth'

interface VehicleRentalOperationsPageProps {
  session: AuthSession
  company: AuthCompany
}

function vehicleLabel(sale: SaleRecord) {
  const vehicle = sale.vehicle
  if (!vehicle) return '—'
  return [vehicle.brand, vehicle.model, vehicle.license_plate].filter(Boolean).join(' · ') || '—'
}

function frequencyLabel(frequency?: string | null): string {
  if (!frequency) return '—'
  return RENTAL_FREQUENCY_LABELS[frequency] ?? frequency
}

function statusStyles(status: number) {
  if (status === 2) return 'bg-[var(--green-100)] text-[var(--green-600)]'
  if (status === 1) return 'bg-[var(--blue-100)] text-[var(--blue-700)]'
  return 'bg-[var(--amber-100)] text-[var(--amber-500)]'
}

export function VehicleRentalOperationsPage({ session, company }: VehicleRentalOperationsPageProps) {
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<SaleRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [detailedInspectionRequired, setDetailedInspectionRequired] = useState(false)
  const [operationTarget, setOperationTarget] = useState<{ sale: SaleRecord; mode: OperationMode } | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchConfig(session.token.token, company.id)
      .then((config) => {
        if (!cancelled) setDetailedInspectionRequired(Boolean(config.vehicle_inspection_detailed_required))
      })
      .catch(() => {
        if (!cancelled) setDetailedInspectionRequired(false)
      })
    return () => {
      cancelled = true
    }
  }, [session.token.token, company.id])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    fetchSales(session.token.token, company.id, { limit: 5000 })
      .then((res) => {
        if (cancelled) return
        const rentals = (res.data || []).filter((sale) => sale.vehicleRentalContract)
        setItems(rentals)
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
  }, [company.id, session.token.token, refreshKey])

  function reload() {
    setRefreshKey((key) => key + 1)
  }

  const term = search.trim().toLowerCase()
  const filtered = items.filter((sale) => {
    if (!term) return true
    const contract = sale.vehicleRentalContract
    return (
      String(sale.internal_code ?? sale.code).includes(term) ||
      (contract?.renter?.name ?? '').toLowerCase().includes(term) ||
      (sale.vehicle?.license_plate ?? '').toLowerCase().includes(term)
    )
  })

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div>
        <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Operação</p>
        <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">Entrega e Devoluções</h1>
        <p className="mt-1 text-[13px] text-[var(--muted)]">
          Registre a entrega do veículo ao locatário e a devolução ao final do aluguel, com vistoria e assinaturas.
        </p>
      </div>

      <div className="flex min-w-[240px] max-w-md items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5">
        <SearchIcon className="h-4 w-4 flex-none text-[var(--muted)]" />
        <input
          type="text"
          placeholder="Buscar por locatário, placa ou código"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-full bg-transparent text-[13.5px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none"
        />
      </div>

      {error && (
        <div className="rounded-2xl bg-[var(--red-100)] p-4 text-[13.5px] font-medium text-[var(--red-500)]">{error}</div>
      )}

      {loading ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-40 animate-pulse rounded-2xl bg-[var(--page)]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-10 text-center">
          <RouteIcon className="mx-auto h-8 w-8 text-[var(--muted)]" />
          <p className="mt-3 text-[13.5px] text-[var(--muted)]">Nenhum aluguel encontrado no momento.</p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filtered.map((sale) => {
            const contract = sale.vehicleRentalContract!
            const status = contract.status ?? 0

            return (
              <article key={sale.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--card-shadow)]">
                <div className="border-b border-[var(--border)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[13px] font-black text-[var(--ink)]">#{sale.internal_code ?? sale.code}</p>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusStyles(status)}`}>
                          {VEHICLE_RENTAL_STATUS_LABELS[status] ?? status}
                        </span>
                      </div>
                      <p className="mt-1.5 text-[15px] font-bold text-[var(--ink)]">{vehicleLabel(sale)}</p>
                      <p className="text-[13px] text-[var(--muted)]">
                        {contract.renter?.name || '—'}
                        {contract.renter && ' · '}
                        {contract.driver?.name ? `Condutor: ${contract.driver.name}` : ''}
                      </p>
                    </div>
                    <p className="text-[13.5px] font-bold text-[var(--ink)]">
                      {formatCurrency(contract.monthlyValue ?? 0)}
                      <span className="ml-1 text-[11px] font-normal text-[var(--muted)]">
                        /{frequencyLabel(contract.rentalFrequency).toLowerCase()}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
                  <div className="rounded-xl bg-[var(--page)] p-3">
                    <p className="text-[10.5px] font-bold tracking-wide text-[var(--muted)] uppercase">Documento do locatário</p>
                    <p className="mt-1 text-[12.5px] font-semibold text-[var(--ink)]">
                      {contract.renter?.document ? formatDocument(contract.renter.document) : '—'}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[var(--page)] p-3">
                    <p className="text-[10.5px] font-bold tracking-wide text-[var(--muted)] uppercase">Entrega / Devolução</p>
                    <p className="mt-1 text-[12.5px] font-semibold text-[var(--ink)]">
                      {contract.pickupDate ? 'Entregue' : 'Aguardando entrega'}
                      {contract.returnDate ? ' · Devolvido' : ''}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-2 px-4 pb-4 sm:flex-row">
                  {status === 0 && (
                    <button
                      type="button"
                      onClick={() => setOperationTarget({ sale, mode: 'pickup' })}
                      className="min-h-11 flex-1 rounded-xl bg-[var(--blue-500)] px-4 py-2 text-[13px] font-bold text-white transition hover:bg-[var(--blue-700)]"
                    >
                      Registrar entrega
                    </button>
                  )}
                  {status === 1 && (
                    <button
                      type="button"
                      onClick={() => setOperationTarget({ sale, mode: 'return' })}
                      className="min-h-11 flex-1 rounded-xl bg-[var(--green-100)] px-4 py-2 text-[13px] font-bold text-[var(--green-600)] transition hover:bg-green-200"
                    >
                      Registrar devolução
                    </button>
                  )}
                  {status === 2 && (
                    <p className="min-h-11 flex-1 rounded-xl bg-[var(--page)] px-4 py-2 text-center text-[13px] font-bold text-[var(--muted)]">
                      Ciclo concluído
                    </p>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}

      {operationTarget && (
        <RentalOperationModal
          session={session}
          company={company}
          sale={operationTarget.sale}
          mode={operationTarget.mode}
          detailedRequired={detailedInspectionRequired}
          onClose={() => setOperationTarget(null)}
          onCompleted={() => {
            setOperationTarget(null)
            reload()
          }}
        />
      )}
    </div>
  )
}
