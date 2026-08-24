import { useCallback } from 'react'
import { fetchPeople, type PersonRecord } from '../lib/people'
import { fetchVehicles, type VehicleRecord } from '../lib/vehicles'
import { formatDocument } from '../lib/formatDocument'
import { SearchSelectField } from './form/SearchSelectField'
import type { AuthSession, AuthCompany } from '../lib/auth'

export interface EntityPick {
  id: string
  label: string
  sub?: string
}

interface ListEntityDateFiltersProps {
  session: AuthSession
  company: AuthCompany
  vehicle: EntityPick | null
  onVehicleChange: (vehicle: EntityPick | null) => void
  person: EntityPick | null
  onPersonChange: (person: EntityPick | null) => void
  personLabel?: string
  dateFrom: string
  onDateFromChange: (value: string) => void
  dateTo: string
  onDateToChange: (value: string) => void
}

export function ListEntityDateFilters({
  session,
  company,
  vehicle,
  onVehicleChange,
  person,
  onPersonChange,
  personLabel = 'Pessoa',
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
}: ListEntityDateFiltersProps) {
  const searchPeople = useCallback(
    (query: string) => fetchPeople(session.token.token, company.id, { search: query, limit: 8 }).then((res) => res.data),
    [session.token.token, company.id]
  )
  const searchVehicles = useCallback(
    (query: string) => fetchVehicles(session.token.token, company.id, { search: query, limit: 8 }).then((res) => res.data),
    [session.token.token, company.id]
  )

  const hasActiveFilter = Boolean(vehicle || person || dateFrom || dateTo)

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-[200px] flex-1">
        <SearchSelectField
          label="Veículo"
          placeholder="Buscar por placa, marca ou modelo"
          variant="surface"
          selectedLabel={vehicle?.label ?? null}
          selectedSubLabel={vehicle?.sub}
          onSearch={searchVehicles}
          getOptionLabel={(item: VehicleRecord) => [item.brand, item.model].filter(Boolean).join(' ') || item.license_plate}
          getOptionSubLabel={(item: VehicleRecord) => item.license_plate}
          onSelect={(item: VehicleRecord) =>
            onVehicleChange({ id: item.id, label: [item.brand, item.model].filter(Boolean).join(' ') || item.license_plate, sub: item.license_plate })
          }
          onClear={() => onVehicleChange(null)}
        />
      </div>
      <div className="min-w-[200px] flex-1">
        <SearchSelectField
          label={personLabel}
          placeholder="Buscar por nome ou documento"
          variant="surface"
          selectedLabel={person?.label ?? null}
          selectedSubLabel={person?.sub ? formatDocument(person.sub) : undefined}
          onSearch={searchPeople}
          getOptionLabel={(item: PersonRecord) => item.name}
          getOptionSubLabel={(item: PersonRecord) => (item.document ? formatDocument(item.document) : undefined)}
          onSelect={(item: PersonRecord) => onPersonChange({ id: item.id, label: item.name, sub: item.document ?? undefined })}
          onClear={() => onPersonChange(null)}
        />
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] font-semibold text-[var(--ink-soft)]">De</span>
        <input
          type="date"
          value={dateFrom}
          onChange={(event) => onDateFromChange(event.target.value)}
          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-[13.5px] text-[var(--ink)] focus:outline-none"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Até</span>
        <input
          type="date"
          value={dateTo}
          onChange={(event) => onDateToChange(event.target.value)}
          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-[13.5px] text-[var(--ink)] focus:outline-none"
        />
      </label>
      {hasActiveFilter && (
        <button
          type="button"
          onClick={() => {
            onVehicleChange(null)
            onPersonChange(null)
            onDateFromChange('')
            onDateToChange('')
          }}
          className="rounded-xl px-3.5 py-2.5 text-[12.5px] font-semibold text-[var(--blue-700)] hover:underline"
        >
          Limpar filtros
        </button>
      )}
    </div>
  )
}
