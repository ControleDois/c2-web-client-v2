import { useEffect, useMemo, useState } from 'react'
import { addDaysToKey, agendaToday, approveGlassOrder, type GlassOrderRecord } from '../../lib/glass'
import { fetchCategories, type CategoryRecord } from '../../lib/categories'
import { fetchBankAccounts, type BankAccountRecord } from '../../lib/bankAccounts'
import { FORM_PAYMENT_LABELS } from '../../lib/bills'
import { formatCurrency } from '../../lib/format'
import { parseMoney } from '../../lib/money'
import { ApiError } from '../../lib/api'
import { MoneyField } from '../../components/form/MoneyField'
import { SelectField } from '../../components/form/SelectField'
import { TextField } from '../../components/form/TextField'
import { CalendarIcon, CloseIcon, TagIcon } from '../../components/icons'
import type { AuthCompany, AuthSession } from '../../lib/auth'

interface GlassApproveSaleModalProps {
  order: GlassOrderRecord | null
  session: AuthSession
  company: AuthCompany
  onClose: () => void
  onApproved: (message: string) => void
}

type Mode = 'cash' | 'term'

interface PlanLine {
  name: string
  due: string
  amount: number
}

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

// Soma meses a um dia (AAAA-MM-DD) mantendo o fim do mês (31/01 + 1 mês = 28/02).
function addMonthsKey(key: string, months: number) {
  const [year, month, day] = key.split('-').map(Number)
  const target = new Date(Date.UTC(year, month - 1 + months, 1, 12))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0, 12)).getUTCDate()
  target.setUTCDate(Math.min(day, lastDay))
  return target.toISOString().slice(0, 10)
}

// Mesma conta do servidor ao gerar as contas a receber: entrada à vista e o
// restante em parcelas mensais; a última parcela absorve os centavos.
function buildPlan(total: number, down: number, count: number, firstDue: string, today: string): PlanLine[] {
  const downPayment = Math.min(Math.max(down, 0), total)
  const remaining = round2(total - downPayment)
  const parts = Math.max(count, 1)
  const lines: PlanLine[] = []
  if (downPayment > 0) lines.push({ name: 'Entrada', due: today, amount: downPayment })
  if (remaining > 0) {
    const base = Math.floor((remaining / parts) * 100) / 100
    for (let index = 0; index < parts; index++) {
      lines.push({
        name: parts > 1 ? `Parcela ${index + 1}/${parts}` : 'Parcela única',
        due: addMonthsKey(firstDue, index),
        amount: index === parts - 1 ? round2(remaining - base * (parts - 1)) : base,
      })
    }
  }
  return lines
}

const dayLabel = (key: string) => key.split('-').reverse().join('/')

// Aprovar a venda: o vendedor escolhe como o cliente vai pagar e o sistema
// já cria as contas a receber, mostrando antes o que vai gerar.
export function GlassApproveSaleModal({ order, session, company, onClose, onApproved }: GlassApproveSaleModalProps) {
  const token = session.token.token
  const today = agendaToday()
  const [mode, setMode] = useState<Mode>('cash')
  const [formPayment, setFormPayment] = useState(10)
  const [downPayment, setDownPayment] = useState('')
  const [installments, setInstallments] = useState('1')
  const [firstDue, setFirstDue] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [bankAccountId, setBankAccountId] = useState('')
  const [categories, setCategories] = useState<CategoryRecord[]>([])
  const [bankAccounts, setBankAccounts] = useState<BankAccountRecord[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const orderId = order?.id
  useEffect(() => {
    if (!order) return
    setError(null)
    setFormPayment(order.form_payment ?? 10)
    const term = (order.installments ?? 1) > 1 || (order.down_payment ?? 0) > 0
    setMode(term ? 'term' : 'cash')
    setDownPayment(order.down_payment ? String(order.down_payment) : '')
    setInstallments(String(order.installments ?? 1))
    setFirstDue(order.first_due_date ? order.first_due_date.slice(0, 10) : addDaysToKey(today, 30))
    setCategoryId(order.category_id ?? '')
    setBankAccountId(order.bank_account_id ?? '')
    let cancelled = false
    fetchCategories(token, company.id, { role: 1, limit: 100 })
      .then((res) => {
        if (cancelled) return
        setCategories(res.data)
        setCategoryId((current) => current || (res.data.length === 1 ? res.data[0].id : ''))
      })
      .catch(() => setCategories([]))
    fetchBankAccounts(token, company.id, { limit: 100 })
      .then((res) => !cancelled && setBankAccounts(res.data))
      .catch(() => setBankAccounts([]))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, token, company.id])

  const total = Number(order?.total ?? 0)
  const down = mode === 'term' ? parseMoney(downPayment) ?? 0 : 0
  const count = mode === 'term' ? Math.min(Math.max(Number(installments) || 1, 1), 120) : 1
  const due = mode === 'cash' ? today : firstDue || addDaysToKey(today, 30)
  const plan = useMemo(() => buildPlan(total, down, count, due, today), [total, down, count, due, today])

  if (!order) return null

  const blocker = !order.people_id
    ? 'Escolha o cliente no orçamento antes de aprovar.'
    : total <= 0
      ? 'O orçamento está com valor R$ 0,00. Informe os preços dos itens antes de aprovar.'
      : null

  async function handleApprove() {
    if (!order || blocker) return
    if (categories.length > 0 && !categoryId) {
      setError('Escolha a categoria financeira: é nela que as contas a receber vão ser lançadas.')
      return
    }
    if (mode === 'term' && down > total) {
      setError('A entrada não pode ser maior que o valor do orçamento.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const result = await approveGlassOrder(token, order.id, {
        form_payment: formPayment,
        installments: count,
        first_due_date: due,
        down_payment: down,
        category_id: categoryId || null,
        bank_account_id: bankAccountId || null,
      })
      const billing = result.meta?.billing
      onApproved(
        billing?.generated
          ? `Venda #${order.code} aprovada e ${plan.length} ${plan.length === 1 ? 'conta a receber gerada' : 'contas a receber geradas'}.`
          : billing?.message
            ? `Venda #${order.code} aprovada, mas as contas a receber não foram geradas: ${billing.message} Abra o pedido para ajustar.`
            : `Venda #${order.code} aprovada.`
      )
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível aprovar a venda.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={saving ? undefined : onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-[600px] flex-col overflow-hidden rounded-2xl bg-[var(--surface)] shadow-[var(--card-shadow)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 p-6 pb-3">
          <div>
            <h2 className="text-[17px] font-bold text-[var(--ink)]">Aprovar venda #{order.code}</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-[var(--ink-soft)]">
              {order.people?.name ?? 'Sem cliente'} · <strong>{formatCurrency(total)}</strong>. Escolha como o cliente vai pagar: ao
              aprovar, o sistema cria as contas a receber.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Fechar"
            className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--page)]"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-2">
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ['cash', 'À vista', 'Cliente paga tudo hoje'],
                ['term', 'A prazo', 'Entrada e/ou parcelas'],
              ] as const
            ).map(([value, label, hint]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={`rounded-xl border px-4 py-3 text-left transition ${
                  mode === value
                    ? 'border-[var(--blue-500)] bg-[var(--blue-100)]'
                    : 'border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--page)]'
                }`}
              >
                <p className="text-[14px] font-bold text-[var(--ink)]">{label}</p>
                <p className="text-[12px] text-[var(--ink-soft)]">{hint}</p>
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <SelectField label="Forma de pagamento" variant="surface" value={formPayment} onChange={(event) => setFormPayment(Number(event.target.value))}>
              {Object.entries(FORM_PAYMENT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectField>
            <SelectField label="Categoria financeira" variant="surface" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
              <option value="">Selecione</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </SelectField>
            {mode === 'term' && (
              <>
                <MoneyField
                  label="Entrada / sinal (R$) — opcional"
                  icon={<TagIcon className="h-4 w-4" />}
                  value={downPayment}
                  onChange={(event) => setDownPayment(event.target.value)}
                />
                <TextField
                  label="Parcelas do restante"
                  icon={<TagIcon className="h-4 w-4" />}
                  inputMode="numeric"
                  value={installments}
                  onChange={(event) => setInstallments(event.target.value.replace(/\D/g, ''))}
                />
                <TextField
                  label="1º vencimento"
                  icon={<CalendarIcon className="h-4 w-4" />}
                  type="date"
                  value={firstDue}
                  onChange={(event) => setFirstDue(event.target.value)}
                />
              </>
            )}
            <SelectField label="Conta bancária (opcional)" variant="surface" value={bankAccountId} onChange={(event) => setBankAccountId(event.target.value)}>
              <option value="">Sem conta definida</option>
              {bankAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </SelectField>
          </div>

          <div className="mt-4 rounded-xl bg-[var(--page)] p-4">
            <p className="text-[12px] font-bold tracking-wide text-[var(--muted)] uppercase">O que vai ser lançado em Contas a Receber</p>
            <div className="mt-2 flex flex-col divide-y divide-[var(--border)]">
              {plan.map((line) => (
                <div key={line.name} className="flex items-center justify-between gap-3 py-1.5 text-[13px]">
                  <span className="font-semibold text-[var(--ink)]">{line.name}</span>
                  <span className="text-[var(--ink-soft)]">{dayLabel(line.due)}</span>
                  <span className="font-bold text-[var(--ink)]">{formatCurrency(line.amount)}</span>
                </div>
              ))}
            </div>
            <p className="mt-2 flex items-center justify-between border-t border-[var(--border)] pt-2 text-[13px] font-bold text-[var(--ink)]">
              <span>Total</span>
              <span>{formatCurrency(plan.reduce((sum, line) => sum + line.amount, 0))}</span>
            </p>
          </div>

          {blocker && <p className="mt-3 rounded-xl bg-[var(--amber-100)] px-4 py-2.5 text-[13px] font-medium text-[var(--ink)]">{blocker}</p>}
          {error && <p className="mt-3 rounded-xl bg-[var(--red-100)] px-4 py-2.5 text-[13px] font-medium text-[var(--red-500)]">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-3 p-6 pt-4">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-xl px-4 py-2.5 text-[14px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]">
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleApprove}
            disabled={saving || Boolean(blocker)}
            className="rounded-xl bg-[var(--blue-500)] px-5 py-2.5 text-[14px] font-bold text-white hover:bg-[var(--blue-700)] disabled:opacity-60"
          >
            {saving ? 'Aprovando…' : 'Aprovar venda e gerar contas a receber'}
          </button>
        </div>
      </div>
    </div>
  )
}
