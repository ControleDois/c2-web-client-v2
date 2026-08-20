import { useEffect, useState } from 'react'
import type { ConfigPayload, ConfigRecord } from '../../lib/config'
import { parseCentralBoxPaymentMethods } from '../../lib/config'
import { fetchPeople, type PersonRecord } from '../../lib/people'
import { fetchCategories, type CategoryRecord } from '../../lib/categories'
import { fetchBankAccounts, type BankAccountRecord } from '../../lib/bankAccounts'
import { FORM_PAYMENT_LABELS } from '../../lib/bills'
import { SectionCard } from '../../components/SectionCard'
import { SearchSelectField } from '../../components/form/SearchSelectField'
import type { AuthSession, AuthCompany } from '../../lib/auth'

interface ConfVendaSectionProps {
  value: ConfigPayload
  onChange: (patch: Partial<ConfigPayload>) => void
  config: ConfigRecord | null
  session: AuthSession
  company: AuthCompany
}

export function ConfVendaSection({ value, onChange, config, session, company }: ConfVendaSectionProps) {
  const [peopleLabel, setPeopleLabel] = useState<string | null>(null)
  const [categoryLabel, setCategoryLabel] = useState<string | null>(null)
  const [bankLabel, setBankLabel] = useState<string | null>(null)

  useEffect(() => {
    setPeopleLabel(config?.sale_people_default?.name ?? null)
    setCategoryLabel(config?.sale_category_default?.name ?? null)
    setBankLabel(config?.sale_bank_account_default?.name ?? null)
  }, [config])

  const paymentMethods = value.central_box_payment_methods ?? parseCentralBoxPaymentMethods(config?.central_box_payment_methods)

  function togglePaymentMethod(type: number) {
    const set = new Set(paymentMethods)
    if (set.has(type)) {
      set.delete(type)
    } else {
      set.add(type)
    }
    onChange({ central_box_payment_methods: Array.from(set).sort((a, b) => a - b) })
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionCard title="Controle Padrão" subtitle="Vendedor, categoria e conta usados por padrão nas vendas">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <SearchSelectField
            label="Vendedor padrão"
            placeholder="Buscar por nome"
            selectedLabel={peopleLabel}
            onSearch={(query) => fetchPeople(session.token.token, company.id, { search: query }).then((res) => res.data)}
            getOptionLabel={(item: PersonRecord) => item.name}
            onSelect={(item: PersonRecord) => {
              setPeopleLabel(item.name)
              onChange({ sale_people_default_id: item.id })
            }}
            onClear={() => {
              setPeopleLabel(null)
              onChange({ sale_people_default_id: undefined })
            }}
          />
          <SearchSelectField
            label="Categoria padrão"
            placeholder="Buscar categoria"
            selectedLabel={categoryLabel}
            onSearch={(query) => fetchCategories(session.token.token, company.id, { search: query }).then((res) => res.data)}
            getOptionLabel={(item: CategoryRecord) => item.name}
            onSelect={(item: CategoryRecord) => {
              setCategoryLabel(item.name)
              onChange({ sale_category_default_id: item.id })
            }}
            onClear={() => {
              setCategoryLabel(null)
              onChange({ sale_category_default_id: undefined })
            }}
          />
          <SearchSelectField
            label="Conta padrão"
            placeholder="Buscar conta"
            selectedLabel={bankLabel}
            onSearch={(query) => fetchBankAccounts(session.token.token, company.id, { search: query }).then((res) => res.data)}
            getOptionLabel={(item: BankAccountRecord) => item.name}
            onSelect={(item: BankAccountRecord) => {
              setBankLabel(item.name)
              onChange({ sale_bank_account_default_id: item.id })
            }}
            onClear={() => {
              setBankLabel(null)
              onChange({ sale_bank_account_default_id: undefined })
            }}
          />
        </div>
      </SectionCard>

      <SectionCard title="Controle de Caixa" subtitle="Caixa central e formas de pagamento aceitas" defaultCollapsed>
        <div className="flex flex-col gap-6">
          <label className="flex items-center gap-2.5">
            <input
              type="checkbox"
              checked={value.central_box_active === 1}
              onChange={(event) => onChange({ central_box_active: event.target.checked ? 1 : 0 })}
              className="h-4 w-4 accent-[var(--blue-500)]"
            />
            <span className="text-[13.5px] font-semibold text-[var(--ink)]">Controle de caixa central ativo</span>
          </label>

          <div>
            <h3 className="mb-2 text-[13px] font-bold text-[var(--ink)]">Formas de pagamento aceitas no caixa</h3>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {Object.entries(FORM_PAYMENT_LABELS).map(([value2, label]) => (
                <label key={value2} className="flex items-center gap-2.5 rounded-xl bg-[var(--page)] px-3.5 py-2">
                  <input
                    type="checkbox"
                    checked={paymentMethods.includes(Number(value2))}
                    onChange={() => togglePaymentMethod(Number(value2))}
                    className="h-4 w-4 accent-[var(--blue-500)]"
                  />
                  <span className="text-[13px] font-semibold text-[var(--ink)]">{label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  )
}
