import { useCallback, useEffect, useState } from 'react'
import { SectionCard } from './SectionCard'
import { SearchSelectField } from './form/SearchSelectField'
import { SelectField } from './form/SelectField'
import { fetchPeople, type PersonRecord } from '../lib/people'
import { fetchCategories, type CategoryRecord } from '../lib/categories'
import { fetchBankAccounts, type BankAccountRecord } from '../lib/bankAccounts'
import { formatDocument } from '../lib/formatDocument'
import type { AuthSession, AuthCompany } from '../lib/auth'

export interface BillsMoreFilters {
  peopleId?: string
  peopleLabel?: string
  categoryId?: string
  bankAccountId?: string
}

interface BillsMoreFiltersPanelProps {
  session: AuthSession
  company: AuthCompany
  role: 0 | 1
  filters: BillsMoreFilters
  onChange: (filters: BillsMoreFilters) => void
}

export function BillsMoreFiltersPanel({ session, company, role, filters, onChange }: BillsMoreFiltersPanelProps) {
  const [categories, setCategories] = useState<CategoryRecord[]>([])
  const [bankAccounts, setBankAccounts] = useState<BankAccountRecord[]>([])

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetchCategories(session.token.token, company.id, { role, limit: 200 }),
      fetchBankAccounts(session.token.token, company.id, { limit: 200 }),
    ]).then(([categoryRes, bankRes]) => {
      if (cancelled) return
      setCategories(categoryRes.data || [])
      setBankAccounts(bankRes.data || [])
    })
    return () => {
      cancelled = true
    }
  }, [session.token.token, company.id, role])

  const searchPeople = useCallback(
    (query: string) =>
      fetchPeople(session.token.token, company.id, { search: query, limit: 8 }).then((res) => res.data),
    [session.token.token, company.id]
  )

  const activeCount = [filters.peopleId, filters.categoryId, filters.bankAccountId].filter(Boolean).length

  return (
    <SectionCard
      title="Mais filtros"
      subtitle={activeCount > 0 ? `${activeCount} filtro${activeCount === 1 ? '' : 's'} ativo${activeCount === 1 ? '' : 's'}` : undefined}
      defaultCollapsed
      headerExtra={
        activeCount > 0 ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onChange({})
            }}
            className="rounded-lg px-2.5 py-1 text-[12px] font-semibold text-[var(--blue-700)] hover:underline"
          >
            Limpar
          </button>
        ) : null
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SearchSelectField
          label={role === 1 ? 'Cliente' : 'Fornecedor'}
          placeholder="Buscar por nome ou documento"
          selectedLabel={filters.peopleLabel ?? null}
          onSearch={searchPeople}
          getOptionLabel={(item: PersonRecord) => item.name}
          getOptionSubLabel={(item: PersonRecord) => (item.document ? formatDocument(item.document) : undefined)}
          onSelect={(item: PersonRecord) => onChange({ ...filters, peopleId: item.id, peopleLabel: item.name })}
          onClear={() => onChange({ ...filters, peopleId: undefined, peopleLabel: undefined })}
        />
        <SelectField
          label="Categoria"
          value={filters.categoryId ?? ''}
          onChange={(event) => onChange({ ...filters, categoryId: event.target.value || undefined })}
        >
          <option value="">Todas</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Conta bancária"
          value={filters.bankAccountId ?? ''}
          onChange={(event) => onChange({ ...filters, bankAccountId: event.target.value || undefined })}
        >
          <option value="">Todas</option>
          {bankAccounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </SelectField>
      </div>
    </SectionCard>
  )
}
