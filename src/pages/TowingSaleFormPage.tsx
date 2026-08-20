import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  createTowingSale,
  fetchTowingSale,
  updateTowingSale,
  TOWING_TYPE_LABELS,
  type TowingSaleRecord,
} from '../lib/towingSale'
import { fetchPeople, type PersonRecord } from '../lib/people'
import { fetchVehicles, type VehicleRecord } from '../lib/vehicles'
import { SALE_STATUS_LABELS } from '../lib/towingDashboard'
import { fetchCepData } from '../lib/cepLookup'
import { formatDocument } from '../lib/formatDocument'
import { formatCep } from '../lib/formatCep'
import { formatCurrency, formatDate } from '../lib/format'
import { BRAZIL_STATES } from '../lib/brazilStates'
import { fetchBills, createBill, deleteBill, FORM_PAYMENT_LABELS, type BillRecord } from '../lib/bills'
import { fetchCategories, type CategoryRecord } from '../lib/categories'
import { fetchBankAccounts, type BankAccountRecord } from '../lib/bankAccounts'
import { ApiError } from '../lib/api'
import { TextField } from '../components/form/TextField'
import { SelectField } from '../components/form/SelectField'
import { SearchSelectField } from '../components/form/SearchSelectField'
import { UserIcon, TagIcon, WalletIcon, TrashIcon, PlusIcon, ChevronLeftIcon } from '../components/icons'
import { SectionCard } from '../components/SectionCard'
import type { AuthSession, AuthCompany } from '../lib/auth'

interface StagedExpense {
  tempId: string
  name: string
  categoryId: string
  categoryName: string
  amount: number
  dateCompetence: string
  dateDue: string
  formPayment: number
  bankAccountId?: string
  peopleId?: string
  peopleName?: string
  note?: string
}

function parseAmount(value: string): number {
  if (!value) return 0
  const normalized = value.includes(',') ? value.replace(/\./g, '').replace(',', '.') : value
  const num = Number(normalized)
  return Number.isNaN(num) ? 0 : num
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

interface TowingSaleFormPageProps {
  session: AuthSession
  company: AuthCompany
  saleId?: string
  onBack: () => void
  onSaved: () => void
}

interface AddressState {
  zip_code: string
  address: string
  number: string
  district: string
  city: string
  state: string
  complement: string
}

const EMPTY_ADDRESS: AddressState = {
  zip_code: '',
  address: '',
  number: '',
  district: '',
  city: '',
  state: '',
  complement: '',
}

const SALE_STATUS_OPTIONS = [0, 1, 2, 3, 4]

interface AddressBlockProps {
  title: string
  value: AddressState
  onChange: (patch: Partial<AddressState>) => void
}

function AddressBlock({ title, value, onChange }: AddressBlockProps) {
  const [cepLoading, setCepLoading] = useState(false)
  const [cepMessage, setCepMessage] = useState<string | null>(null)

  async function handleCepLookup() {
    const digits = value.zip_code.replace(/\D/g, '')
    if (digits.length !== 8) return

    setCepLoading(true)
    setCepMessage(null)
    try {
      const result = await fetchCepData(digits)
      onChange({
        address: result.street || value.address,
        district: result.district || value.district,
        city: result.city || value.city,
        state: result.state || value.state,
      })
    } catch {
      setCepMessage('Não foi possível encontrar o CEP.')
    } finally {
      setCepLoading(false)
    }
  }

  return (
    <SectionCard title={title}>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <TextField
            label="CEP"
            icon={<UserIcon className="h-4 w-4" />}
            placeholder="00000-000"
            value={value.zip_code}
            onChange={(event) => onChange({ zip_code: formatCep(event.target.value) })}
            action={
              value.zip_code.replace(/\D/g, '').length === 8 ? (
                <button
                  type="button"
                  onClick={handleCepLookup}
                  disabled={cepLoading}
                  className="text-[12px] font-semibold text-[var(--blue-700)] hover:underline disabled:opacity-60"
                >
                  {cepLoading ? '…' : 'Buscar'}
                </button>
              ) : undefined
            }
          />
          {cepMessage && <p className="mt-1.5 text-[12px] text-[var(--red-500)]">{cepMessage}</p>}
        </div>
        <div className="sm:col-span-2">
          <TextField
            label="Endereço"
            icon={<UserIcon className="h-4 w-4" />}
            placeholder="Rua, avenida..."
            value={value.address}
            onChange={(event) => onChange({ address: event.target.value })}
          />
        </div>
        <TextField
          label="Número"
          icon={<UserIcon className="h-4 w-4" />}
          placeholder="s/n"
          value={value.number}
          onChange={(event) => onChange({ number: event.target.value })}
        />
        <TextField
          label="Bairro"
          icon={<UserIcon className="h-4 w-4" />}
          placeholder="Bairro"
          value={value.district}
          onChange={(event) => onChange({ district: event.target.value })}
        />
        <TextField
          label="Cidade"
          icon={<UserIcon className="h-4 w-4" />}
          placeholder="Cidade"
          value={value.city}
          onChange={(event) => onChange({ city: event.target.value })}
        />
        <SelectField label="UF" value={value.state} onChange={(event) => onChange({ state: event.target.value })}>
          <option value="">—</option>
          {BRAZIL_STATES.map((uf) => (
            <option key={uf} value={uf}>
              {uf}
            </option>
          ))}
        </SelectField>
        <div className="sm:col-span-2">
          <TextField
            label="Complemento"
            icon={<UserIcon className="h-4 w-4" />}
            placeholder="Opcional"
            value={value.complement}
            onChange={(event) => onChange({ complement: event.target.value })}
          />
        </div>
      </div>
    </SectionCard>
  )
}

export function TowingSaleFormPage({ session, company, saleId, onBack, onSaved }: TowingSaleFormPageProps) {
  const [loading, setLoading] = useState(Boolean(saleId))
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [customer, setCustomer] = useState<{ id: string; label: string; sub?: string } | null>(null)
  const [vehicle, setVehicle] = useState<{ id: string; label: string; sub?: string } | null>(null)
  const [responsible, setResponsible] = useState<{ id: string; label: string } | null>(
    session.user.people ? { id: session.user.people.id, label: session.user.people.name } : null
  )

  const [type, setType] = useState('retirada')
  const [transportValue, setTransportValue] = useState('')
  const [deadlineDays, setDeadlineDays] = useState('1')
  const [status, setStatus] = useState(0)
  const [notes, setNotes] = useState('')

  const [origin, setOrigin] = useState<AddressState>(EMPTY_ADDRESS)
  const [destination, setDestination] = useState<AddressState>(EMPTY_ADDRESS)

  const [createdSaleId, setCreatedSaleId] = useState<string | null>(null)
  const effectiveSaleId = saleId ?? createdSaleId

  const [categories, setCategories] = useState<CategoryRecord[]>([])
  const [bankAccounts, setBankAccounts] = useState<BankAccountRecord[]>([])
  const [existingExpenses, setExistingExpenses] = useState<BillRecord[]>([])
  const [removedExpenseIds, setRemovedExpenseIds] = useState<string[]>([])
  const [stagedExpenses, setStagedExpenses] = useState<StagedExpense[]>([])

  const [expenseName, setExpenseName] = useState('')
  const [expenseCategoryId, setExpenseCategoryId] = useState('')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseDateCompetence, setExpenseDateCompetence] = useState(todayISO())
  const [expenseDateDue, setExpenseDateDue] = useState(todayISO())
  const [expenseFormPayment, setExpenseFormPayment] = useState(9)
  const [expenseBankAccountId, setExpenseBankAccountId] = useState('')
  const [expensePerson, setExpensePerson] = useState<{ id: string; label: string; sub?: string } | null>(null)
  const [expenseNote, setExpenseNote] = useState('')
  const [expenseError, setExpenseError] = useState<string | null>(null)

  useEffect(() => {
    if (!saleId) return
    let cancelled = false
    setLoading(true)
    setLoadError(null)

    fetchTowingSale(session.token.token, saleId)
      .then((sale: TowingSaleRecord) => {
        if (cancelled) return
        setCustomer(sale.people ? { id: sale.people.id, label: sale.people.name, sub: sale.people.document ?? undefined } : null)
        setVehicle(
          sale.vehicle
            ? { id: sale.vehicle.id, label: [sale.vehicle.brand, sale.vehicle.model].filter(Boolean).join(' '), sub: sale.vehicle.license_plate ?? undefined }
            : null
        )
        setResponsible(sale.user ? { id: sale.user.id, label: sale.user.name } : null)
        setType(sale.type ?? 'retirada')
        setTransportValue(sale.transport_value ? String(sale.transport_value) : '')
        setDeadlineDays(sale.deadline_days ? String(sale.deadline_days) : '1')
        setStatus(Number(sale.status ?? 0))
        setNotes(sale.notes ?? '')
        setOrigin({
          zip_code: sale.origin_zip_code ? formatCep(sale.origin_zip_code) : '',
          address: sale.origin_address ?? '',
          number: sale.origin_number ?? '',
          district: sale.origin_district ?? '',
          city: sale.origin_city ?? '',
          state: sale.origin_state ?? '',
          complement: sale.origin_complement ?? '',
        })
        setDestination({
          zip_code: sale.destination_zip_code ? formatCep(sale.destination_zip_code) : '',
          address: sale.destination_address ?? '',
          number: sale.destination_number ?? '',
          district: sale.destination_district ?? '',
          city: sale.destination_city ?? '',
          state: sale.destination_state ?? '',
          complement: sale.destination_complement ?? '',
        })
      })
      .catch((err) => {
        if (cancelled) return
        setLoadError(err instanceof ApiError ? err.message : 'Não foi possível carregar a venda.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [saleId, session.token.token, reloadKey])

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetchCategories(session.token.token, company.id, { role: 0, limit: 200 }),
      fetchBankAccounts(session.token.token, company.id, { limit: 200 }),
    ]).then(([categoryRes, bankRes]) => {
      if (cancelled) return
      setCategories(categoryRes.data || [])
      setBankAccounts(bankRes.data || [])
    })
    return () => {
      cancelled = true
    }
  }, [session.token.token, company.id])

  useEffect(() => {
    if (!saleId) return
    let cancelled = false
    fetchBills(session.token.token, company.id, { role: 0, limit: 200, towingSaleId: saleId }).then((res) => {
      if (cancelled) return
      setExistingExpenses(res.data || [])
    })
    return () => {
      cancelled = true
    }
  }, [saleId, company.id, session.token.token, reloadKey])

  const searchCustomers = useCallback(
    (query: string) =>
      fetchPeople(session.token.token, company.id, { search: query, limit: 8 }).then((res) => res.data),
    [session.token.token, company.id]
  )
  const searchVehicles = useCallback(
    (query: string) =>
      fetchVehicles(session.token.token, company.id, { search: query, limit: 8 }).then((res) => res.data),
    [session.token.token, company.id]
  )
  const searchResponsibles = useCallback(
    (query: string) =>
      fetchPeople(session.token.token, company.id, { search: query, limit: 8, role: 0 }).then((res) => res.data),
    [session.token.token, company.id]
  )
  const searchExpensePeople = useCallback(
    (query: string) =>
      fetchPeople(session.token.token, company.id, { search: query, limit: 8 }).then((res) => res.data),
    [session.token.token, company.id]
  )

  const visibleExistingExpenses = existingExpenses.filter((bill) => !removedExpenseIds.includes(bill.id))
  const expensesTotal = useMemo(() => {
    const existingTotal = visibleExistingExpenses.reduce((sum, bill) => sum + Number(bill.amount || 0), 0)
    const stagedTotal = stagedExpenses.reduce((sum, expense) => sum + expense.amount, 0)
    return existingTotal + stagedTotal
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingExpenses, removedExpenseIds, stagedExpenses])

  function resetExpenseForm() {
    setExpenseName('')
    setExpenseCategoryId('')
    setExpenseAmount('')
    setExpenseDateCompetence(todayISO())
    setExpenseDateDue(todayISO())
    setExpenseFormPayment(9)
    setExpenseBankAccountId('')
    setExpensePerson(null)
    setExpenseNote('')
  }

  function handleAddExpense() {
    setExpenseError(null)
    if (!expenseCategoryId || !expenseName.trim() || !expenseAmount) {
      setExpenseError('Preencha categoria, descrição e valor para adicionar o gasto.')
      return
    }

    const category = categories.find((item) => item.id === expenseCategoryId)
    setStagedExpenses((current) => [
      ...current,
      {
        tempId: `staged-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: expenseName.trim(),
        categoryId: expenseCategoryId,
        categoryName: category?.name ?? '—',
        amount: parseAmount(expenseAmount),
        dateCompetence: expenseDateCompetence,
        dateDue: expenseDateDue,
        formPayment: expenseFormPayment,
        bankAccountId: expenseBankAccountId || undefined,
        peopleId: expensePerson?.id,
        peopleName: expensePerson?.label,
        note: expenseNote || undefined,
      },
    ])
    resetExpenseForm()
  }

  function handleRemoveStagedExpense(tempId: string) {
    setStagedExpenses((current) => current.filter((expense) => expense.tempId !== tempId))
  }

  function handleRemoveExistingExpense(id: string) {
    setRemovedExpenseIds((current) => [...current, id])
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    const payload = {
      companyId: company.id,
      people_id: customer?.id,
      vehicle_id: vehicle?.id,
      user_id: responsible?.id,
      status,
      type,
      transport_value: transportValue ? Number(transportValue) : 0,
      deadline_days: deadlineDays ? Number(deadlineDays) : 1,
      origin_zip_code: origin.zip_code || undefined,
      origin_address: origin.address || undefined,
      origin_number: origin.number || undefined,
      origin_district: origin.district || undefined,
      origin_city: origin.city || undefined,
      origin_state: origin.state || undefined,
      origin_complement: origin.complement || undefined,
      destination_zip_code: destination.zip_code || undefined,
      destination_address: destination.address || undefined,
      destination_number: destination.number || undefined,
      destination_district: destination.district || undefined,
      destination_city: destination.city || undefined,
      destination_state: destination.state || undefined,
      destination_complement: destination.complement || undefined,
      notes: notes || undefined,
    }

    setSubmitting(true)
    try {
      let savedSaleId = effectiveSaleId
      if (effectiveSaleId) {
        await updateTowingSale(session.token.token, effectiveSaleId, payload)
      } else {
        const created = await createTowingSale(session.token.token, payload)
        savedSaleId = created.id
        setCreatedSaleId(created.id)
      }

      const removalResults = await Promise.allSettled(
        removedExpenseIds.map((id) => deleteBill(session.token.token, id).then(() => id))
      )
      const additionResults = await Promise.allSettled(
        stagedExpenses.map((expense) =>
          createBill(session.token.token, {
            company_id: company.id,
            category_id: expense.categoryId,
            role: 0,
            name: expense.name,
            date_competence: expense.dateCompetence,
            date_due: expense.dateDue,
            amount: expense.amount,
            repeat: false,
            form_payment: expense.formPayment,
            status: 0,
            bank_account_id: expense.bankAccountId,
            people_id: expense.peopleId,
            note: expense.note,
            towing_sale_id: savedSaleId!,
          }).then(() => expense.tempId)
        )
      )

      const failedRemovals = removalResults
        .map((result, index) => (result.status === 'rejected' ? removedExpenseIds[index] : null))
        .filter((id): id is string => id !== null)
      const succeededAdditions = additionResults
        .filter((result): result is PromiseFulfilledResult<string> => result.status === 'fulfilled')
        .map((result) => result.value)
      const firstFailure = [...removalResults, ...additionResults].find((result) => result.status === 'rejected') as
        | PromiseRejectedResult
        | undefined

      if (succeededAdditions.length > 0) {
        setStagedExpenses((current) => current.filter((expense) => !succeededAdditions.includes(expense.tempId)))
      }
      setRemovedExpenseIds(failedRemovals)

      if (firstFailure) {
        const reason = firstFailure.reason
        setError(
          reason instanceof ApiError
            ? `A venda foi salva, mas houve um erro ao salvar os gastos: ${reason.message}`
            : 'A venda foi salva, mas houve um erro ao salvar os gastos. Tente novamente.'
        )
        setSubmitting(false)
        return
      }

      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar a venda.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-8">
      <div>
        <button
          type="button"
          onClick={onBack}
          className="mb-3 flex items-center gap-1 text-[12.5px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]"
        >
          <ChevronLeftIcon className="h-3.5 w-3.5" />
          Voltar para vendas de guincho
        </button>
        <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Guincho</p>
        <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">
          {saleId ? 'Editar venda' : 'Nova venda'}
        </h1>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-11 animate-pulse rounded-xl bg-[var(--surface)]" />
          ))}
        </div>
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
          <SectionCard title="Dados da venda">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <SearchSelectField
                label="Cliente"
                placeholder="Buscar por nome ou documento"
                selectedLabel={customer?.label ?? null}
                selectedSubLabel={customer?.sub ? formatDocument(customer.sub) : undefined}
                onSearch={searchCustomers}
                getOptionLabel={(item: PersonRecord) => item.name}
                getOptionSubLabel={(item: PersonRecord) => (item.document ? formatDocument(item.document) : undefined)}
                onSelect={(item: PersonRecord) => setCustomer({ id: item.id, label: item.name, sub: item.document ?? undefined })}
                onClear={() => setCustomer(null)}
              />
              <SearchSelectField
                label="Veículo"
                placeholder="Buscar por placa, marca ou modelo"
                selectedLabel={vehicle?.label ?? null}
                selectedSubLabel={vehicle?.sub}
                onSearch={searchVehicles}
                getOptionLabel={(item: VehicleRecord) => [item.brand, item.model].filter(Boolean).join(' ') || item.license_plate}
                getOptionSubLabel={(item: VehicleRecord) => item.license_plate}
                onSelect={(item: VehicleRecord) =>
                  setVehicle({ id: item.id, label: [item.brand, item.model].filter(Boolean).join(' ') || item.license_plate, sub: item.license_plate })
                }
                onClear={() => setVehicle(null)}
              />
              <SearchSelectField
                label="Responsável"
                placeholder="Buscar por nome"
                selectedLabel={responsible?.label ?? null}
                onSearch={searchResponsibles}
                getOptionLabel={(item: PersonRecord) => item.name}
                onSelect={(item: PersonRecord) => setResponsible({ id: item.id, label: item.name })}
                onClear={() => setResponsible(null)}
              />
              <SelectField label="Tipo" value={type} onChange={(event) => setType(event.target.value)}>
                {Object.entries(TOWING_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </SelectField>
              <TextField
                label="Valor do transporte"
                icon={<UserIcon className="h-4 w-4" />}
                placeholder="0,00"
                inputMode="decimal"
                value={transportValue}
                onChange={(event) => setTransportValue(event.target.value.replace(/[^\d.,]/g, ''))}
              />
              <TextField
                label="Prazo em dias"
                icon={<UserIcon className="h-4 w-4" />}
                placeholder="1"
                inputMode="numeric"
                value={deadlineDays}
                onChange={(event) => setDeadlineDays(event.target.value.replace(/\D/g, ''))}
              />
              <SelectField label="Status" value={status} onChange={(event) => setStatus(Number(event.target.value))}>
                {SALE_STATUS_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {SALE_STATUS_LABELS[value]}
                  </option>
                ))}
              </SelectField>
            </div>
          </SectionCard>

          <div className="grid gap-6 xl:grid-cols-2">
            <AddressBlock title="Origem" value={origin} onChange={(patch) => setOrigin((prev) => ({ ...prev, ...patch }))} />
            <AddressBlock
              title="Destino"
              value={destination}
              onChange={(patch) => setDestination((prev) => ({ ...prev, ...patch }))}
            />
          </div>

          <SectionCard title="Observações" defaultCollapsed>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Opcional"
              rows={3}
              className="w-full resize-none rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition placeholder:text-[var(--muted)] focus:outline-none focus:ring-[var(--blue-300)]"
            />
          </SectionCard>

          <SectionCard
            title="Gastos"
            subtitle="Despesas vinculadas a esta venda de guincho"
            defaultCollapsed
            headerExtra={
              <span className="flex-none text-[13.5px] font-bold text-[var(--ink)]">
                Total: {formatCurrency(expensesTotal)}
              </span>
            }
          >
            <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <TextField
                label="Descrição"
                icon={<TagIcon className="h-4 w-4" />}
                placeholder="Ex: Combustível, pedágio"
                value={expenseName}
                onChange={(event) => setExpenseName(event.target.value)}
              />
              <SelectField
                label="Categoria"
                value={expenseCategoryId}
                onChange={(event) => setExpenseCategoryId(event.target.value)}
              >
                <option value="">Selecione</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </SelectField>
              <TextField
                label="Valor"
                icon={<WalletIcon className="h-4 w-4" />}
                placeholder="0,00"
                inputMode="decimal"
                value={expenseAmount}
                onChange={(event) => setExpenseAmount(event.target.value.replace(/[^\d.,]/g, ''))}
              />
              <SelectField
                label="Forma de pagamento"
                value={expenseFormPayment}
                onChange={(event) => setExpenseFormPayment(Number(event.target.value))}
              >
                {Object.entries(FORM_PAYMENT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </SelectField>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Data de competência</span>
                <input
                  type="date"
                  value={expenseDateCompetence}
                  onChange={(event) => setExpenseDateCompetence(event.target.value)}
                  className="w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Data de vencimento</span>
                <input
                  type="date"
                  value={expenseDateDue}
                  onChange={(event) => setExpenseDateDue(event.target.value)}
                  className="w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                />
              </label>
              <SelectField
                label="Conta bancária"
                value={expenseBankAccountId}
                onChange={(event) => setExpenseBankAccountId(event.target.value)}
              >
                <option value="">Nenhuma</option>
                {bankAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </SelectField>
              <div className="sm:col-span-2 xl:col-span-2">
                <SearchSelectField
                  label="Fornecedor"
                  placeholder="Buscar por nome ou documento"
                  selectedLabel={expensePerson?.label ?? null}
                  selectedSubLabel={expensePerson?.sub ? formatDocument(expensePerson.sub) : undefined}
                  onSearch={searchExpensePeople}
                  getOptionLabel={(item: PersonRecord) => item.name}
                  getOptionSubLabel={(item: PersonRecord) => (item.document ? formatDocument(item.document) : undefined)}
                  onSelect={(item: PersonRecord) => setExpensePerson({ id: item.id, label: item.name, sub: item.document ?? undefined })}
                  onClear={() => setExpensePerson(null)}
                />
              </div>
              <div className="sm:col-span-2 xl:col-span-4">
                <TextField
                  label="Observações do gasto"
                  icon={<TagIcon className="h-4 w-4" />}
                  placeholder="Opcional"
                  value={expenseNote}
                  onChange={(event) => setExpenseNote(event.target.value)}
                />
              </div>
            </div>

            {expenseError && (
              <p className="mb-3 text-[12px] font-medium text-[var(--red-500)]">{expenseError}</p>
            )}

            <button
              type="button"
              onClick={handleAddExpense}
              className="mb-4 flex items-center gap-1.5 rounded-xl border border-[var(--border)] px-3 py-2 text-[12.5px] font-bold text-[var(--ink-soft)] hover:text-[var(--ink)]"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              Adicionar gasto
            </button>

            {visibleExistingExpenses.length === 0 && stagedExpenses.length === 0 ? (
              <p className="py-4 text-center text-[13px] text-[var(--muted)]">Nenhum gasto adicionado ainda.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {visibleExistingExpenses.map((bill) => (
                  <div
                    key={bill.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-[var(--page)] px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-[var(--ink)]">{bill.name}</p>
                      <p className="truncate text-[12px] text-[var(--muted)]">
                        {bill.category?.name ?? '—'} · {formatDate(bill.date_due)}
                      </p>
                    </div>
                    <div className="flex flex-none items-center gap-3">
                      <span className="text-[13px] font-bold text-[var(--ink)]">
                        {formatCurrency(Number(bill.amount || 0))}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveExistingExpense(bill.id)}
                        className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--red-100)] hover:text-[var(--red-500)]"
                        aria-label="Remover gasto"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                {stagedExpenses.map((expense) => (
                  <div
                    key={expense.tempId}
                    className="flex items-center justify-between gap-3 rounded-xl bg-[var(--amber-100)] px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-[var(--ink)]">{expense.name}</p>
                      <p className="truncate text-[12px] text-[var(--muted)]">
                        {expense.categoryName}
                        {expense.peopleName ? ` · ${expense.peopleName}` : ''} · novo
                      </p>
                    </div>
                    <div className="flex flex-none items-center gap-3">
                      <span className="text-[13px] font-bold text-[var(--ink)]">{formatCurrency(expense.amount)}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveStagedExpense(expense.tempId)}
                        className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--red-100)] hover:text-[var(--red-500)]"
                        aria-label="Remover gasto"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

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
              {submitting ? 'Salvando…' : 'Salvar venda'}
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
    </div>
  )
}
