import { useEffect, useState, type FormEvent } from 'react'
import {
  createSupportContract,
  fetchSupportContract,
  updateSupportContract,
} from '../lib/supportContracts'
import { fetchPeople, type PersonRecord } from '../lib/people'
import { fetchCategories, type CategoryRecord } from '../lib/categories'
import { fetchBankAccounts, type BankAccountRecord } from '../lib/bankAccounts'
import { FORM_PAYMENT_LABELS } from '../lib/bills'
import { ApiError } from '../lib/api'
import { SearchSelectField } from '../components/form/SearchSelectField'
import { useQuickPerson } from '../hooks/useQuickPerson'
import { SelectField } from '../components/form/SelectField'
import { TextField } from '../components/form/TextField'
import { ChevronLeftIcon, WrenchIcon, WalletIcon, CalendarIcon } from '../components/icons'
import type { AuthSession, AuthCompany } from '../lib/auth'

interface SupportContractFormPageProps {
  session: AuthSession
  company: AuthCompany
  contractId?: string
  onBack: () => void
  onSaved: () => void
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function parseAmount(value: string): number {
  if (!value) return 0
  const normalized = value.includes(',') ? value.replace(/\./g, '').replace(',', '.') : value
  const num = Number(normalized)
  return Number.isNaN(num) ? 0 : num
}

export function SupportContractFormPage({ session, company, contractId, onBack, onSaved }: SupportContractFormPageProps) {
  const quickPerson = useQuickPerson(session, company)
  const [loading, setLoading] = useState(Boolean(contractId))
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [person, setPerson] = useState<PersonRecord | null>(null)
  const [title, setTitle] = useState('Suporte Técnico Mensal')
  const [monthlyValue, setMonthlyValue] = useState('')
  const [billingDay, setBillingDay] = useState('10')
  const [formPayment, setFormPayment] = useState(10)
  const [categoryId, setCategoryId] = useState('')
  const [categories, setCategories] = useState<CategoryRecord[]>([])
  const [bankAccountId, setBankAccountId] = useState('')
  const [bankAccounts, setBankAccounts] = useState<BankAccountRecord[]>([])
  const [startDate, setStartDate] = useState(todayISO())
  const [occurrences, setOccurrences] = useState('60')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    fetchCategories(session.token.token, company.id, { role: 1, limit: 100 })
      .then((res) => {
        setCategories(res.data)
        setCategoryId((current) => current || res.data[0]?.id || '')
      })
      .catch(() => setCategories([]))
    fetchBankAccounts(session.token.token, company.id, { limit: 100 })
      .then((res) => {
        setBankAccounts(res.data)
        setBankAccountId((current) => current || res.data[0]?.id || '')
      })
      .catch(() => setBankAccounts([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.token.token, company.id])

  useEffect(() => {
    if (!contractId) return
    let cancelled = false
    setLoading(true)
    setLoadError(null)

    fetchSupportContract(session.token.token, contractId)
      .then((contract) => {
        if (cancelled) return
        if (contract.people) {
          setPerson({ id: contract.people.id, name: contract.people.name, document: contract.people.document ?? '' } as PersonRecord)
        }
        setTitle(contract.title)
        setMonthlyValue(String(contract.monthly_value))
        setBillingDay(String(contract.billing_day))
        setFormPayment(contract.form_payment)
        setCategoryId(contract.category_id ?? '')
        setBankAccountId(contract.bank_account_id ?? '')
        setStartDate(contract.start_date ? contract.start_date.slice(0, 10) : todayISO())
        setNotes(contract.notes ?? '')
      })
      .catch((err) => {
        if (cancelled) return
        setLoadError(err instanceof ApiError ? err.message : 'Não foi possível carregar o contrato.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [contractId, session.token.token, reloadKey])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (!person) {
      setError('Selecione o cliente do contrato.')
      return
    }
    if (!categoryId) {
      setError('Selecione a categoria financeira.')
      return
    }
    const value = parseAmount(monthlyValue)
    if (!value) {
      setError('Informe o valor mensal do suporte.')
      return
    }

    setSubmitting(true)
    try {
      if (contractId) {
        await updateSupportContract(session.token.token, contractId, {
          people_id: person.id,
          category_id: categoryId,
          bank_account_id: bankAccountId || undefined,
          title: title.trim() || 'Suporte Técnico',
          monthly_value: value,
          billing_day: Number(billingDay) || 10,
          form_payment: formPayment,
          notes: notes.trim() || undefined,
        })
      } else {
        await createSupportContract(session.token.token, {
          company_id: company.id,
          people_id: person.id,
          category_id: categoryId,
          bank_account_id: bankAccountId || undefined,
          title: title.trim() || 'Suporte Técnico',
          monthly_value: value,
          billing_day: Number(billingDay) || 10,
          form_payment: formPayment,
          start_date: startDate,
          occurrences: Number(occurrences) || 60,
          notes: notes.trim() || undefined,
        })
      }
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar o contrato.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div>
        <button
          type="button"
          onClick={onBack}
          className="mb-3 flex items-center gap-1 text-[12.5px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]"
        >
          <ChevronLeftIcon className="h-3.5 w-3.5" />
          Voltar para contratos de suporte
        </button>
        <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Suporte Técnico</p>
        <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">
          {contractId ? 'Editar contrato de suporte' : 'Novo contrato de suporte'}
        </h1>
      </div>

      {loading ? (
        <div className="h-11 animate-pulse rounded-xl bg-[var(--surface)]" />
      ) : loadError ? (
        <div className="flex flex-col items-start gap-3 rounded-2xl bg-[var(--red-100)] p-5">
          <p className="text-[13.5px] font-medium text-[var(--red-500)]">{loadError}</p>
          <button
            type="button"
            onClick={() => setReloadKey((key) => key + 1)}
            className="rounded-xl bg-[var(--surface)] px-4 py-2 text-[13px] font-bold text-[var(--red-500)] hover:bg-white"
          >
            Tentar novamente
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="mb-4 text-[14px] font-bold text-[var(--ink)]">Cliente e contrato</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div className="sm:col-span-2 xl:col-span-1">
                <SearchSelectField
                  label="Cliente"
                  placeholder="Buscar por nome…"
                  selectedLabel={person?.name ?? null}
                  selectedSubLabel={person?.document ?? undefined}
                  onSearch={(query) =>
                    fetchPeople(session.token.token, company.id, { search: query, role: 2, limit: 8 }).then(
                      (res) => res.data
                    )
                  }
                  getOptionLabel={(item: PersonRecord) => item.name}
                  getOptionSubLabel={(item: PersonRecord) => item.document ?? undefined}
                  onSelect={(item: PersonRecord) => setPerson(item)}
                  onCreate={(typed) =>
                    quickPerson.request({ role: 2, name: typed, onCreated: (item: PersonRecord) => setPerson(item) })
                  }
                  onClear={() => setPerson(null)}
                />
              </div>
              <div className="sm:col-span-2 xl:col-span-2">
                <TextField
                  label="Título do contrato"
                  icon={<WrenchIcon className="h-4 w-4" />}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="mb-4 text-[14px] font-bold text-[var(--ink)]">Cobrança mensal</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Valor mensal</span>
                <div className="flex items-center gap-2 rounded-xl bg-[var(--page)] px-3.5 py-2.5 ring-1 ring-transparent transition focus-within:ring-[var(--blue-300)]">
                  <WalletIcon className="h-4 w-4 flex-none text-[var(--muted)]" />
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={monthlyValue}
                    onChange={(event) => setMonthlyValue(event.target.value.replace(/[^\d.,]/g, ''))}
                    className="min-w-0 w-full bg-[var(--page)] text-[14px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none"
                  />
                </div>
              </label>
              <TextField
                label="Dia de vencimento"
                icon={<CalendarIcon className="h-4 w-4" />}
                type="number"
                min={1}
                max={28}
                value={billingDay}
                onChange={(event) => setBillingDay(event.target.value)}
              />
              <SelectField
                label="Forma de pagamento"
                value={formPayment}
                onChange={(event) => setFormPayment(Number(event.target.value))}
              >
                {Object.entries(FORM_PAYMENT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </SelectField>
              <SelectField
                label="Categoria"
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
              >
                <option value="">Selecione</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </SelectField>
              <SelectField
                label="Conta bancária"
                value={bankAccountId}
                onChange={(event) => setBankAccountId(event.target.value)}
              >
                <option value="">Selecione</option>
                {bankAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </SelectField>
              {!contractId && (
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Início</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                    className="min-w-0 w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                  />
                </label>
              )}
            </div>

            {!contractId && (
              <label className="mt-4 flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Gerar quantas parcelas já?</span>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={occurrences}
                  onChange={(event) => setOccurrences(event.target.value)}
                  className="w-full max-w-xs rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                />
                <span className="text-[11px] text-[var(--ink-soft)]">
                  As parcelas mensais já nascem lançadas em Contas a Receber - sem precisar de renovação toda hora.
                </span>
              </label>
            )}
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="mb-4 text-[14px] font-bold text-[var(--ink)]">Observações</h2>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              placeholder="Observações internas sobre este contrato (opcional)"
              className="w-full resize-none rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
            />
          </div>

          {error && (
            <p className="rounded-xl bg-[var(--red-100)] px-4 py-3 text-[13.5px] font-medium text-[var(--red-500)]">
              {error}
            </p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-[var(--blue-500)] px-6 py-2.5 text-[14px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:opacity-60"
            >
              {submitting ? 'Salvando…' : 'Salvar'}
            </button>
            <button
              type="button"
              onClick={onBack}
              className="rounded-xl px-5 py-2.5 text-[14px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
      {quickPerson.modal}
    </div>
  )
}
