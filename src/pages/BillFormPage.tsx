import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  createBill,
  fetchBill,
  updateBill,
  FORM_PAYMENT_LABELS,
  REPEAT_PERIOD_LABELS,
  type BillRecord,
} from '../lib/bills'
import { fetchCategories, type CategoryRecord } from '../lib/categories'
import { fetchBankAccounts, type BankAccountRecord } from '../lib/bankAccounts'
import { fetchCostCenters, type CostCenterRecord } from '../lib/costCenters'
import { fetchPeople, type PersonRecord } from '../lib/people'
import { formatDocument } from '../lib/formatDocument'
import { formatCurrency } from '../lib/format'
import { ApiError } from '../lib/api'
import { TextField } from '../components/form/TextField'
import { SelectField } from '../components/form/SelectField'
import { SearchSelectField } from '../components/form/SearchSelectField'
import { WalletIcon, TagIcon, ChevronLeftIcon } from '../components/icons'
import type { AuthSession, AuthCompany } from '../lib/auth'

interface BillFormPageProps {
  session: AuthSession
  company: AuthCompany
  role: 0 | 1
  billId?: string
  onBack: () => void
  onSaved: () => void
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function BillFormPage({ session, company, role, billId, onBack, onSaved }: BillFormPageProps) {
  const [loading, setLoading] = useState(Boolean(billId))
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [categories, setCategories] = useState<CategoryRecord[]>([])
  const [bankAccounts, setBankAccounts] = useState<BankAccountRecord[]>([])
  const [costCenters, setCostCenters] = useState<CostCenterRecord[]>([])

  const [formPayment, setFormPayment] = useState(9)
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [bankAccountId, setBankAccountId] = useState('')
  const [creditCardId, setCreditCardId] = useState('')
  const [dateCompetence, setDateCompetence] = useState(todayISO())
  const [dateDue, setDateDue] = useState(todayISO())
  const [amount, setAmount] = useState('')

  const [person, setPerson] = useState<{ id: string; label: string; sub?: string } | null>(null)
  const [costCenterId, setCostCenterId] = useState('')
  const [note, setNote] = useState('')

  const [repeat, setRepeat] = useState(false)
  const [repeatPeriod, setRepeatPeriod] = useState(2)
  const [repeatOccurrences, setRepeatOccurrences] = useState('2')

  const [settled, setSettled] = useState(false)
  const [dateReceived, setDateReceived] = useState(todayISO())
  const [discount, setDiscount] = useState('')
  const [fees, setFees] = useState('')
  const [billValue, setBillValue] = useState('')

  const isCreditCardPayment = formPayment === 1
  const selectedBankAccount = bankAccounts.find((account) => account.id === bankAccountId)
  const availableCreditCards = useMemo(() => selectedBankAccount?.credit_cards ?? [], [selectedBankAccount])
  const selectedCreditCard = availableCreditCards.find((card) => card.id === creditCardId)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetchCategories(session.token.token, company.id, { role, limit: 200 }),
      fetchBankAccounts(session.token.token, company.id, { limit: 200 }),
      fetchCostCenters(session.token.token, company.id, { limit: 200 }),
    ]).then(([categoryRes, bankRes, costCenterRes]) => {
      if (cancelled) return
      setCategories(categoryRes.data || [])
      setBankAccounts(bankRes.data || [])
      setCostCenters(costCenterRes.data || [])
    })
    return () => {
      cancelled = true
    }
  }, [session.token.token, company.id, role])

  useEffect(() => {
    if (!billId) return
    let cancelled = false
    setLoading(true)
    setLoadError(null)

    fetchBill(session.token.token, billId)
      .then((bill: BillRecord) => {
        if (cancelled) return
        setFormPayment(bill.form_payment ?? 9)
        setName(bill.name ?? '')
        setCategoryId(bill.categoryId ?? bill.category?.id ?? '')
        setBankAccountId(bill.bankAccountId ?? bill.bank?.id ?? '')
        setCreditCardId(bill.creditCardId ?? bill.credit_card?.id ?? '')
        setDateCompetence(bill.date_competence ? bill.date_competence.slice(0, 10) : todayISO())
        setDateDue(bill.date_due ? bill.date_due.slice(0, 10) : todayISO())
        setAmount(bill.amount ? String(bill.amount) : '')
        setPerson(bill.people ? { id: bill.people.id, label: bill.people.name } : null)
        setCostCenterId(bill.costCenterId ?? '')
        setNote(bill.note ?? '')
        setRepeat(Boolean(bill.repeat_period !== undefined && bill.repeat_period !== null && bill.installments && bill.installments > 1))
        setRepeatPeriod(bill.repeat_period ?? 2)
        setRepeatOccurrences(bill.installments ? String(bill.installments) : '2')
        setSettled(bill.status === 1)
        setDateReceived(bill.date_received ? bill.date_received.slice(0, 10) : todayISO())
        setDiscount(bill.discount ? String(bill.discount) : '')
        setFees(bill.fees ? String(bill.fees) : '')
        setBillValue(bill.bill_value ? String(bill.bill_value) : '')
      })
      .catch((err) => {
        if (cancelled) return
        setLoadError(err instanceof ApiError ? err.message : 'Não foi possível carregar a conta.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [billId, session.token.token, reloadKey])

  function handleFormPaymentChange(value: number) {
    setFormPayment(value)
    if (value === 1) {
      setSettled(false)
      setDateReceived('')
      setDiscount('')
      setFees('')
      setBillValue(amount)
    } else {
      setCreditCardId('')
    }
  }

  const searchPeople = useCallback(
    (query: string) =>
      fetchPeople(session.token.token, company.id, { search: query, limit: 8 }).then((res) => res.data),
    [session.token.token, company.id]
  )

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (!categoryId || !name.trim() || !amount) {
      setError('Preencha categoria, descrição e valor para continuar.')
      return
    }
    if (isCreditCardPayment && !creditCardId) {
      setError('Selecione o cartão de crédito usado nessa conta.')
      return
    }

    const isSettled = isCreditCardPayment ? false : settled

    const payload = {
      company_id: company.id,
      category_id: categoryId,
      role,
      name: name.trim(),
      date_competence: dateCompetence,
      date_due: dateDue,
      amount: Number(amount),
      repeat,
      repeat_period: repeat ? repeatPeriod : undefined,
      repeat_occurrences: repeat ? Number(repeatOccurrences || 1) : undefined,
      installments: repeat ? Number(repeatOccurrences || 1) : 1,
      installment_number: 1,
      form_payment: formPayment,
      status: isSettled ? 1 : 0,
      bank_account_id: bankAccountId || undefined,
      credit_card_id: isCreditCardPayment ? creditCardId : undefined,
      people_id: person?.id,
      cost_center_id: costCenterId || undefined,
      note: note || undefined,
      date_received: isSettled ? dateReceived : undefined,
      discount: isSettled && discount ? Number(discount) : undefined,
      fees: isSettled && fees ? Number(fees) : undefined,
      bill_value: isCreditCardPayment ? Number(amount) : isSettled && billValue ? Number(billValue) : undefined,
    }

    setSubmitting(true)
    try {
      if (billId) {
        await updateBill(session.token.token, billId, payload)
      } else {
        await createBill(session.token.token, payload)
      }
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar a conta.')
    } finally {
      setSubmitting(false)
    }
  }

  const title = role === 1 ? 'conta a receber' : 'conta a pagar'
  const settledLabel = role === 1 ? 'Recebido?' : 'Pago?'
  const settledDateLabel = role === 1 ? 'Data de recebimento' : 'Data de pagamento'
  const settledValueLabel = role === 1 ? 'Valor recebido' : 'Valor pago'

  return (
    <div className="flex flex-col gap-6 p-8">
      <div>
        <button
          type="button"
          onClick={onBack}
          className="mb-3 flex items-center gap-1 text-[12.5px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]"
        >
          <ChevronLeftIcon className="h-3.5 w-3.5" />
          Voltar
        </button>
        <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Financeiro</p>
        <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)] capitalize">
          {billId ? `Editar ${title}` : `Nova ${title}`}
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
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="mb-4 text-[14px] font-bold text-[var(--ink)]">Dados</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <SelectField label="Forma de pagamento" value={formPayment} onChange={(event) => handleFormPaymentChange(Number(event.target.value))}>
                {Object.entries(FORM_PAYMENT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </SelectField>
              <div className="sm:col-span-1 xl:col-span-3">
                <TextField
                  label="Descrição"
                  icon={<TagIcon className="h-4 w-4" />}
                  placeholder="Ex: Combustível do mês, Frete cliente X"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
              <SelectField label="Categoria" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
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
                onChange={(event) => {
                  setBankAccountId(event.target.value)
                  setCreditCardId('')
                }}
              >
                <option value="">Nenhuma</option>
                {bankAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </SelectField>

              {isCreditCardPayment && (
                <div className="sm:col-span-2">
                  <SelectField label="Cartão de crédito" value={creditCardId} onChange={(event) => setCreditCardId(event.target.value)}>
                    <option value="">Selecione o cartão</option>
                    {availableCreditCards.map((card) => (
                      <option key={card.id} value={card.id}>
                        {card.name}
                        {card.last_digits ? ` • final ${card.last_digits}` : ''} • fecha dia {card.closing_day} • vence dia {card.due_day}
                      </option>
                    ))}
                  </SelectField>
                  {selectedBankAccount && availableCreditCards.length === 0 && (
                    <p className="mt-1.5 text-[12px] font-semibold text-[var(--amber-500)]">
                      A conta selecionada ainda não possui cartão cadastrado.
                    </p>
                  )}
                  {selectedCreditCard && (
                    <p className="mt-1.5 rounded-lg bg-[var(--blue-100)] px-3 py-2 text-[12px] font-bold text-[var(--blue-700)]">
                      Limite: {formatCurrency(selectedCreditCard.limit_value ?? 0)} · Disponível após esse lançamento:{' '}
                      {formatCurrency((selectedCreditCard.limit_value ?? 0) - Number(amount || 0))}
                    </p>
                  )}
                </div>
              )}

              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Data de competência</span>
                <input
                  type="date"
                  value={dateCompetence}
                  onChange={(event) => setDateCompetence(event.target.value)}
                  className="w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Data de vencimento</span>
                <input
                  type="date"
                  value={dateDue}
                  onChange={(event) => setDateDue(event.target.value)}
                  className="w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                />
              </label>
              <TextField
                label="Valor"
                icon={<WalletIcon className="h-4 w-4" />}
                placeholder="0,00"
                inputMode="decimal"
                value={amount}
                onChange={(event) => {
                  const next = event.target.value.replace(/[^\d.,]/g, '')
                  setAmount(next)
                  if (isCreditCardPayment) setBillValue(next)
                }}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="mb-4 text-[14px] font-bold text-[var(--ink)]">Pessoa e observação</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div className="xl:col-span-2">
                <SearchSelectField
                  label={role === 1 ? 'Cliente' : 'Fornecedor'}
                  placeholder="Buscar por nome ou documento"
                  selectedLabel={person?.label ?? null}
                  selectedSubLabel={person?.sub ? formatDocument(person.sub) : undefined}
                  onSearch={searchPeople}
                  getOptionLabel={(item: PersonRecord) => item.name}
                  getOptionSubLabel={(item: PersonRecord) => (item.document ? formatDocument(item.document) : undefined)}
                  onSelect={(item: PersonRecord) => setPerson({ id: item.id, label: item.name, sub: item.document ?? undefined })}
                  onClear={() => setPerson(null)}
                />
              </div>
              <SelectField label="Centro de custo" value={costCenterId} onChange={(event) => setCostCenterId(event.target.value)}>
                <option value="">Nenhum</option>
                {costCenters.map((center) => (
                  <option key={center.id} value={center.id}>
                    {center.name}
                  </option>
                ))}
              </SelectField>
              <div className="sm:col-span-2 xl:col-span-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Observações</span>
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Opcional"
                    rows={3}
                    className="w-full resize-none rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition placeholder:text-[var(--muted)] focus:outline-none focus:ring-[var(--blue-300)]"
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="mb-4 text-[14px] font-bold text-[var(--ink)]">{role === 1 ? 'Recebimento' : 'Pagamento'}</h2>

            <label className="mb-4 flex items-center gap-2.5">
              <input
                type="checkbox"
                checked={repeat}
                onChange={(event) => setRepeat(event.target.checked)}
                className="h-4 w-4 accent-[var(--blue-500)]"
              />
              <span className="text-[13.5px] font-semibold text-[var(--ink)]">Repetir?</span>
            </label>

            {repeat && (
              <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <SelectField label="Período" value={repeatPeriod} onChange={(event) => setRepeatPeriod(Number(event.target.value))}>
                  {Object.entries(REPEAT_PERIOD_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </SelectField>
                <TextField
                  label="Ocorrências / vezes"
                  icon={<TagIcon className="h-4 w-4" />}
                  placeholder="2"
                  inputMode="numeric"
                  value={repeatOccurrences}
                  onChange={(event) => setRepeatOccurrences(event.target.value.replace(/\D/g, ''))}
                />
              </div>
            )}

            {isCreditCardPayment ? (
              <div className="rounded-lg bg-[var(--blue-100)] p-4 text-[13px] font-semibold text-[var(--blue-700)]">
                Lançamento no cartão fica em aberto até a fatura ser gerada. Ao gerar a fatura, esses lançamentos
                serão agrupados.
              </div>
            ) : (
              <>
                <label className="mb-4 flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={settled}
                    onChange={(event) => setSettled(event.target.checked)}
                    className="h-4 w-4 accent-[var(--blue-500)]"
                  />
                  <span className="text-[13.5px] font-semibold text-[var(--ink)]">{settledLabel}</span>
                </label>

                {settled && (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <label className="flex flex-col gap-1.5">
                      <span className="text-[12px] font-semibold text-[var(--ink-soft)]">{settledDateLabel}</span>
                      <input
                        type="date"
                        value={dateReceived}
                        onChange={(event) => setDateReceived(event.target.value)}
                        className="w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                      />
                    </label>
                    <TextField
                      label="Descontos"
                      icon={<WalletIcon className="h-4 w-4" />}
                      placeholder="0,00"
                      inputMode="decimal"
                      value={discount}
                      onChange={(event) => setDiscount(event.target.value.replace(/[^\d.,]/g, ''))}
                    />
                    <TextField
                      label="Juros"
                      icon={<WalletIcon className="h-4 w-4" />}
                      placeholder="0,00"
                      inputMode="decimal"
                      value={fees}
                      onChange={(event) => setFees(event.target.value.replace(/[^\d.,]/g, ''))}
                    />
                    <TextField
                      label={settledValueLabel}
                      icon={<WalletIcon className="h-4 w-4" />}
                      placeholder="0,00"
                      inputMode="decimal"
                      value={billValue}
                      onChange={(event) => setBillValue(event.target.value.replace(/[^\d.,]/g, ''))}
                    />
                  </div>
                )}
              </>
            )}
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
    </div>
  )
}
