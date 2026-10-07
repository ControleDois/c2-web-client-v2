import { useCallback } from 'react'
import { fetchProducts, type ProductRecord } from '../../lib/products'
import { SearchSelectField } from './SearchSelectField'
import type { AuthCompany, AuthSession } from '../../lib/auth'

interface FiscalProductFieldProps {
  session: AuthSession
  company: AuthCompany
  label?: string
  variant?: 'page' | 'surface'
  value: { id: string; name: string } | null
  onChange: (product: { id: string; name: string } | null) => void
}

// Seleção do produto fiscal (NCM e tributação) usado ao emitir nota.
export function FiscalProductField({ session, company, label = 'Produto fiscal', variant = 'page', value, onChange }: FiscalProductFieldProps) {
  const search = useCallback(
    (query: string) => fetchProducts(session.token.token, company.id, { search: query, limit: 8 }).then((res) => res.data),
    [session.token.token, company.id]
  )

  return (
    <SearchSelectField
      label={label}
      variant={variant}
      placeholder="Buscar produto por nome ou código"
      selectedLabel={value?.name ?? null}
      onSearch={search}
      getOptionLabel={(item: ProductRecord) => item.name}
      getOptionSubLabel={(item: ProductRecord) => (item.code ? `#${item.code}` : undefined)}
      onSelect={(item: ProductRecord) => onChange({ id: item.id, name: item.name })}
      onClear={() => onChange(null)}
    />
  )
}
