import { useEffect, useMemo, useState } from 'react'
import { batchReceiveBills, FORM_PAYMENT_LABELS, type BillRecord } from '../lib/bills'
import { fetchCategories, type CategoryRecord } from '../lib/categories'
import { fetchBankAccounts, type BankAccountRecord } from '../lib/bankAccounts'
import { fetchCostCenters, type CostCenterRecord } from '../lib/costCenters'
import { formatCurrency } from '../lib/format'
import { ApiError } from '../lib/api'
import { SelectField } from './form/SelectField'
import { TextField } from './form/TextField'
import { CloseIcon, WalletIcon, CheckCircleIcon } from './icons'
import type { AuthSession, AuthCompany } from '../lib/auth'

interface BatchReceiveBillsModalProps {
  open: boolean
  session: AuthSession
  company: AuthCompany
  bills: BillRecord[]
  onClose: () => void
  onSuccess: () => void
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function parseAmount(value: string): number {
  const normalized = value.replace(/\./g, '').replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

export function BatchReceiveBillsModal({ open, session, company, bills, onClose, onSuccess }: BatchReceiveBillsModalProps) {
  const [categories, setCategories] = useState<CategoryRecord[]>([])
  const [bankAccounts, setBankAccounts] = useState<BankAccountRecord[]>([])
  const [costCenters, setCostCenters] = useState<CostCenterRecord[]>([])

  const [interest, setInterest] = useState('')
  const [discount, setDiscount] = useState('')
  const [amountPaid, setAmountPaid] = useState('')
  const [amountTouched, setAmountTouched] = useState(false)
  const [dateReceived, setDateReceived] = useState(todayISO())
  const [nextDueDate, setNextDueDate] = useState(todayISO())
  const [bankAccountId, setBankAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [costCenterId, setCostCenterId] = useState('')
  const [formPayment, setFormPayment] = useState(9)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totalOriginal = useMemo(() => bills.reduce((sum, bill) => sum + Number(bill.amount || 0), 0), [bills])
  const differentPeople = useMemo(() => {
    const ids = new Set(bills.map((bill) => bill.peopleId ?? bill.people?.id ?? ''))
    return ids.size > 1
  }, [bills])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    Promise.all([
      fetchCategories(session.token.token, company.id, { role: 1, limit: 200 }),
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
  }, [open, session.token.token, company.id])

  useEffect(() => {
    if (!open) return
    const feesDefault = bills.reduce((sum, bill) => sum + Number(bill.fees_calculated ?? bill.fees ?? 0), 0)
    setInterest(feesDefault ? String(feesDefault.toFixed(2)) : '')
    setDiscount('')
    setAmountTouched(false)
    setDateReceived(todayISO())
    setNextDueDate(todayISO())
    setBankAccountId('')
    setCategoryId('')
    setCostCenterId('')
    setFormPayment(9)
    setError(null)
  }, [open, bills])

  const interestValue = parseAmount(interest)
  const discountValue = parseAmount(discount)
  const computedAmount = Math.max(0, totalOriginal + interestValue - discountValue)

  useEffect(() => {
    if (!amountTouched) setAmountPaid(computedAmount ? computedAmount.toFixed(2) : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computedAmount])

  const amountPaidValue = parseAmount(amountPaid)
  const balance = Math.max(0, Number((computedAmount - amountPaidValue).toFixed(2)))
  const hasBalance = balance > 0.01

  if (!open) return null

  async function handleSubmit() {
    setError(null)
    if (differentPeople) {
      setError('Selecione apenas contas da mesma pessoa para receber em lote.')
      return
    }
    if (!bankAccountId || !categoryId) {
      setError('Selecione a conta bancária e a categoria para continuar.')
      return
    }
    if (hasBalance && !nextDueDate) {
      setError('Informe o vencimento do saldo devedor restante.')
      return
    }

    setSubmitting(true)
    try {
      await batchReceiveBills(session.token.token, {
        ids: bills.map((bill) => bill.id),
        interest: interestValue || undefined,
        discount: discountValue || undefined,
        amountPaid: amountPaidValue,
        date_received: dateReceived,
        bank_account_id: bankAccountId,
        category_id: categoryId,
        cost_center_id: costCenterId || undefined,
        form_payment: formPayment,
        nextDueDate: hasBalance ? nextDueDate : undefined,
      })
      onSuccess()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível receber as contas selecionadas.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-[560px] flex-col overflow-hidden rounded-2xl bg-[var(--surface)] shadow-[var(--card-shadow)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--green-100)] text-[var(--green-600)]">
              <CheckCircleIcon className="h-4.5 w-4.5" />
            </span>
            <div>
              <h2 className="text-[15px] font-bold text-[var(--ink)]">Receber selecionados</h2>
              <p className="text-[12.5px] text-[var(--ink-soft)]">
                {bills.length} conta{bills.length === 1 ? '' : 's'} · {formatCurrency(totalOriginal)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--page)] hover:text-[var(--ink)]"
            aria-label="Fechar"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {differentPeople && (
            <p className="mb-4 rounded-xl bg-[var(--red-100)] px-4 py-3 text-[13px] font-semibold text-[var(--red-500)]">
              As contas selecionadas pertencem a pessoas diferentes. Selecione apenas contas da mesma pessoa.
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Juros"
              icon={<WalletIcon className="h-4 w-4" />}
              placeholder="0,00"
              inputMode="decimal"
              value={interest}
              onChange={(event) => setInterest(event.target.value.replace(/[^\d.,]/g, ''))}
            />
            <TextField
              label="Desconto"
              icon={<WalletIcon className="h-4 w-4" />}
              placeholder="0,00"
              inputMode="decimal"
              value={discount}
              onChange={(event) => setDiscount(event.target.value.replace(/[^\d.,]/g, ''))}
            />
            <div className="sm:col-span-2">
              <TextField
                label="Valor pago"
                icon={<WalletIcon className="h-4 w-4" />}
                placeholder="0,00"
                inputMode="decimal"
                value={amountPaid}
                onChange={(event) => {
                  setAmountTouched(true)
                  setAmountPaid(event.target.value.replace(/[^\d.,]/g, ''))
                }}
              />
            </div>

            {hasBalance && (
              <div className="sm:col-span-2 rounded-xl bg-[var(--amber-100)] p-4">
                <p className="text-[13px] font-bold text-[var(--amber-500)]">
                  Saldo devedor: {formatCurrency(balance)}
                </p>
                <p className="mt-1 text-[12px] text-[var(--ink-soft)]">
                  O valor pago é menor que o total. Uma conta de "RESÍDUO" será criada com esse saldo.
                </p>
                <label className="mt-2.5 flex flex-col gap-1.5">
                  <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Vencimento do saldo</span>
                  <input
                    type="date"
                    value={nextDueDate}
                    onChange={(event) => setNextDueDate(event.target.value)}
                    className="min-w-0 w-full rounded-xl bg-[var(--surface)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                  />
                </label>
              </div>
            )}

            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Data de recebimento</span>
              <input
                type="date"
                value={dateReceived}
                onChange={(event) => setDateReceived(event.target.value)}
                className="min-w-0 w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
              />
            </label>
            <SelectField label="Forma de pagamento" value={formPayment} onChange={(event) => setFormPayment(Number(event.target.value))}>
              {Object.entries(FORM_PAYMENT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectField>
            <SelectField label="Conta bancária" value={bankAccountId} onChange={(event) => setBankAccountId(event.target.value)}>
              <option value="">Selecione</option>
              {bankAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </SelectField>
            <SelectField label="Categoria" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
              <option value="">Selecione</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </SelectField>
            <div className="sm:col-span-2">
              <SelectField label="Centro de custo" value={costCenterId} onChange={(event) => setCostCenterId(event.target.value)}>
                <option value="">Nenhum</option>
                {costCenters.map((center) => (
                  <option key={center.id} value={center.id}>
                    {center.name}
                  </option>
                ))}
              </SelectField>
            </div>
          </div>

          {error && (
            <p className="mt-4 rounded-xl bg-[var(--red-100)] px-4 py-3 text-[13px] font-medium text-[var(--red-500)]">
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[var(--border)] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl px-4 py-2 text-[13.5px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)] disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || differentPeople}
            className="rounded-xl bg-[var(--green-600)] px-5 py-2.5 text-[13.5px] font-bold text-white transition hover:brightness-95 disabled:opacity-60"
          >
            {submitting ? 'Recebendo…' : 'Confirmar recebimento'}
          </button>
        </div>
      </div>
    </div>
  )
}
