import { useEffect, useState } from 'react'
import {
  fetchSupportContracts,
  createSupportContract,
  updateSupportContract,
  deleteSupportContract,
  SUPPORT_CONTRACT_STATUS_LABELS,
  type SupportContractRecord,
} from '../lib/supportContracts'
import { fetchPeople, type PersonRecord } from '../lib/people'
import { fetchCategories, type CategoryRecord } from '../lib/categories'
import { fetchBankAccounts, type BankAccountRecord } from '../lib/bankAccounts'
import { FORM_PAYMENT_LABELS } from '../lib/bills'
import { ApiError } from '../lib/api'
import { formatCurrency, formatDate } from '../lib/format'
import { SearchSelectField } from '../components/form/SearchSelectField'
import { SelectField } from '../components/form/SelectField'
import { TextField } from '../components/form/TextField'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { RowActionsMenu, type RowAction } from '../components/RowActionsMenu'
import {
  PlusIcon,
  WrenchIcon,
  UserIcon,
  WalletIcon,
  CloseIcon,
  XCircleIcon,
  TrashIcon,
  CalendarIcon,
} from '../components/icons'
import type { AuthSession, AuthCompany } from '../lib/auth'

interface SupportContractsPageProps {
  session: AuthSession
  company: AuthCompany
}

function parseAmount(value: string): number {
  if (!value) return 0
  const normalized = value.includes(',') ? value.replace(/\./g, '').replace(',', '.') : value
  const num = Number(normalized)
  return Number.isNaN(num) ? 0 : num
}

function statusTone(status: number): string {
  return status === 1 ? 'bg-[var(--page)] text-[var(--muted)]' : 'bg-[var(--green-100)] text-[var(--green-600)]'
}

function NewContractModal({
  session,
  company,
  onClose,
  onCreated,
}: {
  session: AuthSession
  company: AuthCompany
  onClose: () => void
  onCreated: () => void
}) {
  const [person, setPerson] = useState<PersonRecord | null>(null)
  const [title, setTitle] = useState('Suporte Técnico Mensal')
  const [monthlyValue, setMonthlyValue] = useState('')
  const [billingDay, setBillingDay] = useState('10')
  const [formPayment, setFormPayment] = useState(10)
  const [categoryId, setCategoryId] = useState('')
  const [categories, setCategories] = useState<CategoryRecord[]>([])
  const [bankAccountId, setBankAccountId] = useState('')
  const [bankAccounts, setBankAccounts] = useState<BankAccountRecord[]>([])
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [occurrences, setOccurrences] = useState('60')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchCategories(session.token.token, company.id, { role: 1, limit: 100 })
      .then((res) => {
        setCategories(res.data)
        if (res.data.length) setCategoryId(res.data[0].id)
      })
      .catch(() => setCategories([]))
    fetchBankAccounts(session.token.token, company.id, { limit: 100 })
      .then((res) => {
        setBankAccounts(res.data)
        if (res.data.length) setBankAccountId(res.data[0].id)
      })
      .catch(() => setBankAccounts([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSave() {
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

    setSaving(true)
    try {
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
      onCreated()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível criar o contrato.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-[560px] flex-col overflow-hidden rounded-2xl bg-[var(--surface)] shadow-[var(--card-shadow)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
          <h2 className="text-[15px] font-bold text-[var(--ink)]">Novo Contrato de Suporte</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--page)] hover:text-[var(--ink)]"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="flex flex-col gap-4">
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
              onClear={() => setPerson(null)}
            />

            <TextField
              label="Título do contrato"
              icon={<WrenchIcon className="h-4 w-4" />}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />

            <div className="grid gap-4 sm:grid-cols-2">
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
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
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
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
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
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Início</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="min-w-0 w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                />
              </label>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Gerar quantas parcelas já?</span>
              <input
                type="number"
                min={1}
                max={120}
                value={occurrences}
                onChange={(event) => setOccurrences(event.target.value)}
                className="min-w-0 w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
              />
              <span className="text-[11px] text-[var(--ink-soft)]">
                As parcelas mensais já nascem lançadas em Contas a Receber - sem precisar de renovação toda hora.
              </span>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Observações (opcional)</span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={2}
                className="w-full resize-none rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
              />
            </label>

            {error && (
              <p className="rounded-xl bg-[var(--red-100)] px-3.5 py-2.5 text-[13px] font-medium text-[var(--red-500)]">
                {error}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[var(--border)] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl px-4 py-2 text-[13.5px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)] disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl bg-[var(--blue-500)] px-5 py-2.5 text-[13.5px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:opacity-60"
          >
            {saving ? 'Criando…' : 'Criar contrato'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function SupportContractsPage({ session, company }: SupportContractsPageProps) {
  const token = session.token.token
  const [contracts, setContracts] = useState<SupportContractRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [cancelTarget, setCancelTarget] = useState<SupportContractRecord | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SupportContractRecord | null>(null)
  const [busy, setBusy] = useState(false)

  function load() {
    setLoading(true)
    setError(null)
    fetchSupportContracts(token, company.id, { search: search || undefined, limit: 50 })
      .then((res) => setContracts(res.data))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Não foi possível carregar os contratos.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [token, company.id, search])

  async function handleCancel() {
    if (!cancelTarget) return
    setBusy(true)
    try {
      await updateSupportContract(token, cancelTarget.id, { status: 1 })
      setCancelTarget(null)
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível cancelar o contrato.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setBusy(true)
    try {
      await deleteSupportContract(token, deleteTarget.id)
      setDeleteTarget(null)
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível excluir o contrato.')
    } finally {
      setBusy(false)
    }
  }

  function buildActions(contract: SupportContractRecord): RowAction[] {
    const actions: RowAction[] = []
    if (contract.status === 0) {
      actions.push({
        key: 'cancel',
        label: 'Cancelar contrato',
        icon: <XCircleIcon className="h-4 w-4" />,
        tone: 'warning',
        onClick: () => setCancelTarget(contract),
      })
    }
    actions.push({
      key: 'delete',
      label: 'Excluir',
      icon: <TrashIcon className="h-4 w-4" />,
      tone: 'danger',
      dividerBefore: contract.status === 0,
      onClick: () => setDeleteTarget(contract),
    })
    return actions
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-bold text-[var(--ink)]">Contratos de Suporte</h1>
          <p className="mt-1 text-[13px] text-[var(--muted)]">
            Cliente + valor mensal de suporte técnico - gera as parcelas automaticamente em Contas a Receber.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 rounded-xl bg-[var(--blue-500)] px-4 py-2.5 text-[13px] font-bold text-white transition hover:bg-[var(--blue-700)]"
        >
          <PlusIcon className="h-4 w-4" />
          Novo Contrato
        </button>
      </div>

      <input
        type="text"
        placeholder="Buscar por cliente…"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-[13px] text-[var(--ink)] focus:outline-none"
      />

      {error && (
        <p className="rounded-xl bg-[var(--red-100)] px-3.5 py-2.5 text-[13px] font-medium text-[var(--red-500)]">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-20 animate-pulse rounded-2xl bg-[var(--surface)]" />
          ))}
        </div>
      ) : contracts.length === 0 ? (
        <p className="py-10 text-center text-[13px] text-[var(--muted)]">Nenhum contrato de suporte cadastrado.</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {contracts.map((contract) => (
            <div
              key={contract.id}
              className="flex flex-col gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-[var(--blue-100)] text-[var(--blue-700)]">
                  <UserIcon className="h-4.5 w-4.5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-bold text-[var(--ink)]">{contract.people?.name ?? '—'}</p>
                  <p className="text-[12px] text-[var(--muted)]">
                    {contract.title} · vence dia {contract.billing_day} · desde {formatDate(contract.start_date)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 sm:flex-none">
                <span className={`rounded-full px-2.5 py-1 text-[10.5px] font-bold ${statusTone(contract.status)}`}>
                  {SUPPORT_CONTRACT_STATUS_LABELS[contract.status] ?? '—'}
                </span>
                <span className="text-[14px] font-bold text-[var(--ink)]">
                  {formatCurrency(Number(contract.monthly_value))}
                  <span className="text-[11px] font-normal text-[var(--muted)]">/mês</span>
                </span>
                <RowActionsMenu actions={buildActions(contract)} />
              </div>
            </div>
          ))}
        </div>
      )}

      {showNew && (
        <NewContractModal
          session={session}
          company={company}
          onClose={() => setShowNew(false)}
          onCreated={() => {
            setShowNew(false)
            load()
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        title="Cancelar contrato"
        message={`As parcelas futuras ainda pendentes de "${cancelTarget?.people?.name ?? ''}" serão removidas de Contas a Receber. Parcelas já pagas ou vencidas não são afetadas.`}
        confirmLabel="Cancelar contrato"
        loading={busy}
        onConfirm={handleCancel}
        onCancel={() => setCancelTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Excluir contrato"
        message={`Tem certeza que deseja excluir o contrato de "${deleteTarget?.people?.name ?? ''}"? As parcelas pendentes também serão removidas.`}
        confirmLabel="Excluir"
        loading={busy}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
