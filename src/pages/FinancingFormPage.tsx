import { useEffect, useState } from 'react'
import { createSale, fetchSale, updateSale, type SalePlotPayload } from '../lib/sales'
import { fetchPeople, type PersonRecord } from '../lib/people'
import { fetchConfig } from '../lib/config'
import { formatCurrency } from '../lib/format'
import { ApiError } from '../lib/api'
import { useMyCompanyPerson } from '../hooks/useMyCompanyPerson'
import { SearchSelectField } from '../components/form/SearchSelectField'
import { SectionCard } from '../components/SectionCard'
import { ChevronLeftIcon, WalletIcon } from '../components/icons'
import type { AuthSession, AuthCompany } from '../lib/auth'

interface FinancingFormPageProps {
  session: AuthSession
  company: AuthCompany
  saleId?: string
  onBack: () => void
  onSaved: () => void
}

interface Installment {
  number: number
  date: string
  amount: number
  principalAmount: number
  interestAmount: number
}

interface Frequency {
  id: string
  label: string
  days: number
}

const FREQUENCIES: Frequency[] = [
  { id: 'daily', label: 'Diário', days: 1 },
  { id: 'weekly', label: 'Semanal', days: 7 },
  { id: 'biweekly', label: 'Quinzenal', days: 14 },
  { id: 'monthly', label: 'Mensal', days: 30 },
  { id: 'quarterly', label: 'Trimestral', days: 90 },
]

function round3(value: number): number {
  return Math.round(value * 1000) / 1000
}

function parseAmount(value: string): number {
  if (!value) return 0
  const normalized = value.includes(',') ? value.replace(/\./g, '').replace(',', '.') : value
  const num = Number(normalized)
  return Number.isNaN(num) ? 0 : num
}

function todayIso(): string {
  return new Date().toISOString().split('T')[0]
}

// Mesmo formato de digitação usado no Valor Principal (vírgula decimal),
// sem símbolo de moeda - só pra exibição nos 3 campos editáveis do resumo.
function toAmountInput(value: number): string {
  return value ? value.toFixed(2).replace('.', ',') : ''
}

// Newton-Raphson pra achar a taxa de juros por período que gera o PMT
// informado, dado o principal e o número de parcelas - mesmo algoritmo do
// Angular (financing.ts), usado tanto pra reconstruir a taxa ao editar uma
// venda salva quanto ao recalcular a partir de qualquer campo editado
// manualmente (parcela/total/juros/linha da tabela).
function calculateRate(pv: number, pmt: number, n: number): number {
  let rate = 0.01
  for (let i = 0; i < 20; i++) {
    const pow = Math.pow(1 + rate, n)
    const f = (pv * rate * pow) / (pow - 1) - pmt
    const df =
      pv *
      (Math.pow(rate + 1, n) / (Math.pow(rate + 1, n) - 1) -
        (n * rate * Math.pow(rate + 1, n - 1)) / Math.pow(Math.pow(rate + 1, n) - 1, 2))
    rate = rate - f / df
  }
  return rate > 0 ? rate : 0
}

// Tabela Price: parcela fixa a partir de principal + taxa mensal + prazo em
// meses (a frequência escolhida é convertida pra "meses totais" proporcional
// a períodos de 30 dias, igual ao Angular).
function calculatePrice(
  principal: number,
  ratePercent: number,
  installments: number,
  frequencyId: string
): { installmentValue: number; totalAmount: number; totalInterest: number } {
  const taxaMensal = ratePercent / 100
  const freqConfig = FREQUENCIES.find((f) => f.id === frequencyId)
  const diasTotais = installments * (freqConfig?.days || 30)
  const mesesTotais = diasTotais / 30

  let pMensal = 0
  if (taxaMensal === 0 || mesesTotais === 0) {
    pMensal = mesesTotais > 0 ? principal / mesesTotais : 0
  } else {
    const factor = 1 - Math.pow(1 + taxaMensal, -mesesTotais)
    pMensal = principal * (taxaMensal / factor)
  }

  const montanteTotal = pMensal * mesesTotais

  return {
    totalAmount: round3(montanteTotal),
    totalInterest: round3(montanteTotal - principal),
    installmentValue: installments > 0 ? round3(montanteTotal / installments) : 0,
  }
}

function generateList(firstDate: string, installments: number, frequencyId: string, amount: number): Installment[] {
  if (!firstDate || installments <= 0) return []

  const parts = firstDate.split('-')
  const startDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
  const list: Installment[] = []

  for (let i = 1; i <= installments; i++) {
    const currentDate = new Date(startDate)
    if (frequencyId === 'monthly') {
      currentDate.setMonth(startDate.getMonth() + (i - 1))
    } else if (frequencyId === 'quarterly') {
      currentDate.setMonth(startDate.getMonth() + (i - 1) * 3)
    } else {
      const days = FREQUENCIES.find((f) => f.id === frequencyId)?.days || 0
      currentDate.setDate(startDate.getDate() + (i - 1) * days)
    }
    list.push({
      number: i,
      date: currentDate.toISOString().split('T')[0],
      amount,
      principalAmount: 0,
      interestAmount: 0,
    })
  }

  return list
}

// Separa capital vs. juros por parcela (tabela Price clássica): juros do
// período = saldo devedor anterior × taxa; amortização = parcela − juros. A
// última parcela quita o saldo restante pra corrigir arredondamentos.
function calculateAmortization(
  list: Installment[],
  principal: number,
  installmentValue: number,
  installments: number
): Installment[] {
  let saldo = principal
  const taxaPeriodo = calculateRate(principal, installmentValue, installments)

  return list.map((item, index) => {
    let juros = saldo * taxaPeriodo
    let amortizacao = item.amount - juros

    if (index === list.length - 1) {
      amortizacao = saldo
      juros = item.amount - amortizacao
    }

    const interestAmount = round3(juros)
    const principalAmount = round3(amortizacao)
    saldo -= amortizacao

    return { ...item, interestAmount, principalAmount }
  })
}

export function FinancingFormPage({ session, company, saleId, onBack, onSaved }: FinancingFormPageProps) {
  const myPerson = useMyCompanyPerson(session, company)

  const [loading, setLoading] = useState(Boolean(saleId))
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [selectedPerson, setSelectedPerson] = useState<PersonRecord | null>(null)
  const [valueInput, setValueInput] = useState('')
  const [rate, setRate] = useState(25)
  const [installments, setInstallments] = useState(1)
  const [frequency, setFrequency] = useState('monthly')
  const [firstDate, setFirstDate] = useState(todayIso())
  const [note, setNote] = useState('')

  const [previewList, setPreviewList] = useState<Installment[]>([])
  const [installmentValue, setInstallmentValue] = useState(0)
  const [totalAmount, setTotalAmount] = useState(0)
  const [totalInterest, setTotalInterest] = useState(0)

  // Buffers de texto dos 3 campos editáveis do resumo - só sincronizam com
  // os números quando o campo NÃO está em foco, pra não embaralhar o cursor
  // enquanto o operador digita (o número já reformatado a cada tecla
  // quebraria a digitação com vírgula decimal).
  const [focusedSummaryField, setFocusedSummaryField] = useState<string | null>(null)
  const [installmentValueInput, setInstallmentValueInput] = useState('')
  const [totalAmountInput, setTotalAmountInput] = useState('')
  const [totalInterestInput, setTotalInterestInput] = useState('')

  useEffect(() => {
    if (focusedSummaryField !== 'installment') setInstallmentValueInput(toAmountInput(installmentValue))
    if (focusedSummaryField !== 'total') setTotalAmountInput(toAmountInput(totalAmount))
    if (focusedSummaryField !== 'interest') setTotalInterestInput(toAmountInput(totalInterest))
  }, [installmentValue, totalAmount, totalInterest, focusedSummaryField])

  const [categoryId, setCategoryId] = useState<string | undefined>()
  const [bankAccountId, setBankAccountId] = useState<string | undefined>()

  const value = parseAmount(valueInput)

  useEffect(() => {
    fetchConfig(session.token.token, company.id)
      .then((config) => {
        setCategoryId(config?.sale_category_default_id ?? undefined)
        setBankAccountId(config?.sale_bank_account_default_id ?? undefined)
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.token.token, company.id])

  useEffect(() => {
    if (!saleId) return
    let cancelled = false
    setLoading(true)
    setLoadError(null)

    fetchSale(session.token.token, saleId)
      .then((sale) => {
        if (cancelled) return
        if (sale.people) setSelectedPerson(sale.people as PersonRecord)

        const principal = Number(sale.amount || 0)
        const n = Number(sale.payment_terms || 1)
        setValueInput(String(principal))
        setInstallments(n)
        setNote(sale.note || '')

        const total = Number(sale.net_total || 0)
        setTotalAmount(total)
        setTotalInterest(total - principal)

        if (sale.bills && sale.bills.length > 0) {
          const list: Installment[] = sale.bills
            .slice()
            .sort((a, b) => (a.installment_number ?? 0) - (b.installment_number ?? 0))
            .map((bill) => ({
              number: bill.installment_number ?? 1,
              date: (bill.date_due ?? '').slice(0, 10),
              amount: Number(bill.amount || 0),
              principalAmount: Number(bill.principal_amount || 0),
              interestAmount: Number(bill.interest_amount || 0),
            }))
          setPreviewList(list)
          setFirstDate(list[0]?.date || todayIso())

          const firstAmount = Number(sale.bills[0].amount || 0)
          setInstallmentValue(firstAmount)

          // Deduz a taxa a partir do capital/parcela/prazo salvos, já que ela
          // nunca é persistida (só um valor de digitação, reconstruído aqui
          // pra edição continuar coerente com o resto da tela).
          const freqConfig = FREQUENCIES.find((f) => f.id === frequency)
          const diasPeriodo = freqConfig?.days || 30
          const taxaReal = calculateRate(principal, firstAmount, n)
          setRate(round3(taxaReal * (30 / diasPeriodo) * 100))
        }

        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        setLoadError(err instanceof ApiError ? err.message : 'Não foi possível carregar a venda.')
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saleId, session.token.token])

  function applyFullCalculation(overrides: {
    value?: number
    rate?: number
    installments?: number
    frequency?: string
    firstDate?: string
  }) {
    const principal = overrides.value ?? value
    const rateNum = overrides.rate ?? rate
    const n = overrides.installments ?? installments
    const freq = overrides.frequency ?? frequency
    const date = overrides.firstDate ?? firstDate

    if (!principal || !n) {
      setPreviewList([])
      setInstallmentValue(0)
      setTotalAmount(0)
      setTotalInterest(0)
      return
    }

    const { installmentValue: iv, totalAmount: ta, totalInterest: ti } = calculatePrice(principal, rateNum, n, freq)
    let list = generateList(date, n, freq, iv)
    list = calculateAmortization(list, principal, iv, n)

    setInstallmentValue(iv)
    setTotalAmount(ta)
    setTotalInterest(ti)
    setPreviewList(list)
  }

  function handleRecalculateFromParcel(newInstallmentValue: number) {
    const novoTotal = round3(newInstallmentValue * installments)
    const novoInteresse = round3(novoTotal - value)
    const freqConfig = FREQUENCIES.find((f) => f.id === frequency)
    const mesesTotais = (installments * (freqConfig?.days || 30)) / 30
    const novaTaxa = round3(calculateRate(value, novoTotal / mesesTotais, mesesTotais) * 100)

    let list = generateList(firstDate, installments, frequency, newInstallmentValue)
    list = calculateAmortization(list, value, newInstallmentValue, installments)

    setTotalAmount(novoTotal)
    setTotalInterest(novoInteresse)
    setRate(novaTaxa)
    setInstallmentValue(newInstallmentValue)
    setPreviewList(list)
  }

  function handleRecalculateFromTotal(newTotal: number) {
    const novaParcela = installments > 0 ? Number((newTotal / installments).toFixed(2)) : 0
    handleRecalculateFromParcel(novaParcela)
  }

  function handleRecalculateFromInterest(newInterest: number) {
    handleRecalculateFromTotal(value + newInterest)
  }

  function handleUpdateFromTable(updated: Installment[]) {
    const newTotal = updated.reduce((acc, item) => acc + Number(item.amount || 0), 0)
    const newInstallmentValue = installments > 0 ? round3(newTotal / installments) : 0

    const freqConfig = FREQUENCIES.find((f) => f.id === frequency)
    const diasPeriodo = freqConfig?.days || 30
    const taxaPeriodo = calculateRate(value, newInstallmentValue, installments)
    const novaTaxa = round3(taxaPeriodo * (30 / diasPeriodo) * 100)

    const list = calculateAmortization(updated, value, newInstallmentValue, installments)

    setTotalAmount(round3(newTotal))
    setTotalInterest(round3(newTotal - value))
    setInstallmentValue(newInstallmentValue)
    setRate(novaTaxa)
    setPreviewList(list)
  }

  const searchPeople = (query: string) =>
    fetchPeople(session.token.token, company.id, { search: query, limit: 8 }).then((res) => res.data)

  async function handleSubmit() {
    setError(null)

    if (!selectedPerson) {
      setError('Selecione o cliente.')
      return
    }
    if (!value) {
      setError('Informe o valor principal.')
      return
    }
    if (!installments || installments <= 0) {
      setError('Informe o número de parcelas.')
      return
    }
    if (previewList.length === 0) {
      setError('Não foi possível gerar as parcelas — confira os valores informados.')
      return
    }
    if (!myPerson) {
      setError('Carregando usuário responsável — tente novamente em instantes.')
      return
    }

    const availableLimit = Number(selectedPerson.available_limit ?? 0)
    if (availableLimit <= 0) {
      setError('Limite de crédito insuficiente.')
      return
    }
    if (value > availableLimit) {
      setError('Valor da venda maior que o limite de crédito.')
      return
    }

    const plots: SalePlotPayload[] = previewList.map((item) => ({
      portion: item.number,
      form_payment: 9,
      date_due: item.date,
      amount: item.amount,
      principal_amount: item.principalAmount,
      interest_amount: item.interestAmount,
      status: 0,
    }))

    setSubmitting(true)
    try {
      const payload = {
        companyId: company.id,
        peopleId: selectedPerson.id,
        userId: myPerson.id,
        categoryId,
        bankAccountId,
        role: 1,
        status: 3,
        date_sale: todayIso(),
        amount: value,
        payment_terms: installments,
        net_total: totalAmount,
        note,
        plots,
      }

      if (saleId) {
        await updateSale(session.token.token, saleId, payload)
      } else {
        await createSale(session.token.token, payload)
      }
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar a venda.')
    } finally {
      setSubmitting(false)
    }
  }

  const creditRatio =
    selectedPerson?.limit_credit && Number(selectedPerson.limit_credit) > 0
      ? (Number(selectedPerson.available_limit ?? 0) / Number(selectedPerson.limit_credit)) * 100
      : 0

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex h-9 w-9 flex-none items-center justify-center rounded-xl border border-[var(--border)] text-[var(--ink-soft)] hover:bg-[var(--surface)] hover:text-[var(--ink)]"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </button>
        <div>
          <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Principal</p>
          <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">Nova Venda</h1>
          <p className="text-[12.5px] text-[var(--ink-soft)]">
            Metodologia Price, com ajuste manual de parcelas e totais.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2.5">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-11 animate-pulse rounded-xl bg-[var(--page)]" />
          ))}
        </div>
      ) : loadError ? (
        <p className="rounded-xl bg-[var(--red-100)] px-4 py-3 text-[13px] font-medium text-[var(--red-500)]">
          {loadError}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="flex flex-col gap-6 lg:col-span-4">
            <SectionCard title="Configuração">
              <div className="flex flex-col gap-5">
                <SearchSelectField
                  label="Cliente"
                  placeholder="Buscar por nome, documento ou código"
                  selectedLabel={selectedPerson?.name ?? null}
                  selectedSubLabel={selectedPerson?.document ?? undefined}
                  onSearch={searchPeople}
                  getOptionLabel={(item: PersonRecord) => item.name}
                  getOptionSubLabel={(item: PersonRecord) => item.document ?? undefined}
                  onSelect={(item: PersonRecord) => setSelectedPerson(item)}
                  onClear={() => setSelectedPerson(null)}
                />

                {selectedPerson && (
                  <div
                    className={`rounded-xl p-3 ${
                      Number(selectedPerson.available_limit ?? 0) > 0
                        ? 'bg-[var(--green-100)]'
                        : 'bg-[var(--red-100)]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                        Limite Disponível
                      </span>
                      <span
                        className={`text-[13.5px] font-bold ${
                          Number(selectedPerson.available_limit ?? 0) > 0
                            ? 'text-[var(--green-600)]'
                            : 'text-[var(--red-500)]'
                        }`}
                      >
                        {formatCurrency(Number(selectedPerson.available_limit ?? 0))}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--border)]">
                      <div
                        className={`h-full ${
                          Number(selectedPerson.available_limit ?? 0) > 0 ? 'bg-[var(--green-600)]' : 'bg-[var(--red-500)]'
                        }`}
                        style={{ width: `${Math.max(0, Math.min(100, creditRatio))}%` }}
                      />
                    </div>
                    <div className="mt-1 flex justify-between text-[10px] uppercase text-[var(--muted)]">
                      <span>Total: {formatCurrency(Number(selectedPerson.limit_credit ?? 0))}</span>
                      {Number(selectedPerson.available_limit ?? 0) <= 0 && (
                        <span className="font-bold text-[var(--red-500)]">Limite Excedido</span>
                      )}
                    </div>
                  </div>
                )}

                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Valor Principal (R$)</span>
                  <div className="flex items-center gap-2 rounded-xl bg-[var(--page)] px-3.5 py-2.5 ring-1 ring-transparent transition focus-within:ring-[var(--blue-300)]">
                    <WalletIcon className="h-4 w-4 flex-none text-[var(--muted)]" />
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={valueInput}
                      onChange={(event) => {
                        const raw = event.target.value.replace(/[^\d.,]/g, '')
                        setValueInput(raw)
                        applyFullCalculation({ value: parseAmount(raw) })
                      }}
                      className="min-w-0 w-full bg-[var(--page)] text-[16px] font-semibold text-[var(--blue-700)] placeholder:text-[var(--muted)] focus:outline-none"
                    />
                  </div>
                </label>

                <div className="grid grid-cols-2 gap-4">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Taxa %</span>
                    <input
                      type="number"
                      step="0.01"
                      value={rate}
                      onChange={(event) => {
                        const num = Number(event.target.value) || 0
                        setRate(num)
                        applyFullCalculation({ rate: num })
                      }}
                      className="min-w-0 w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] font-semibold text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Parcelas</span>
                    <input
                      type="number"
                      min={1}
                      value={installments}
                      onChange={(event) => {
                        const num = Math.max(1, Number(event.target.value) || 1)
                        setInstallments(num)
                        applyFullCalculation({ installments: num })
                      }}
                      className="min-w-0 w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-center text-[14px] font-semibold text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Frequência</span>
                    <select
                      value={frequency}
                      onChange={(event) => {
                        setFrequency(event.target.value)
                        applyFullCalculation({ frequency: event.target.value })
                      }}
                      className="min-w-0 w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                    >
                      {FREQUENCIES.map((freq) => (
                        <option key={freq.id} value={freq.id}>
                          {freq.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-semibold text-[var(--ink-soft)]">1º Vencimento</span>
                    <input
                      type="date"
                      value={firstDate}
                      onChange={(event) => {
                        setFirstDate(event.target.value)
                        applyFullCalculation({ firstDate: event.target.value })
                      }}
                      className="min-w-0 w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                    />
                  </label>
                </div>

                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Observação</span>
                  <textarea
                    rows={4}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    className="w-full resize-none rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                  />
                </label>

                {error && (
                  <p className="rounded-xl bg-[var(--red-100)] px-3.5 py-2.5 text-[13px] font-medium text-[var(--red-500)]">
                    {error}
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting || previewList.length === 0}
                  className="w-full rounded-xl bg-[var(--blue-500)] py-3 text-[14px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:opacity-50"
                >
                  {submitting ? 'Salvando…' : 'Gerar Contas'}
                </button>
              </div>
            </SectionCard>
          </div>

          <div className="flex flex-col gap-6 lg:col-span-8">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-2xl bg-[var(--blue-500)] p-5 text-white shadow-[var(--card-shadow)]">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-100">Média Parcela</p>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-[13px] text-blue-200">R$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={installmentValueInput}
                    onFocus={() => setFocusedSummaryField('installment')}
                    onChange={(event) => setInstallmentValueInput(event.target.value.replace(/[^\d.,]/g, ''))}
                    onBlur={(event) => {
                      setFocusedSummaryField(null)
                      handleRecalculateFromParcel(parseAmount(event.target.value))
                    }}
                    className="w-full min-w-0 border-0 bg-transparent p-0 text-[22px] font-bold text-white focus:outline-none focus:ring-0"
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-blue-200">Editável (recalcula taxa)</p>
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">Total Juros</p>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-[13px] text-[var(--muted)]">R$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={totalInterestInput}
                    onFocus={() => setFocusedSummaryField('interest')}
                    onChange={(event) => setTotalInterestInput(event.target.value.replace(/[^\d.,]/g, ''))}
                    onBlur={(event) => {
                      setFocusedSummaryField(null)
                      handleRecalculateFromInterest(parseAmount(event.target.value))
                    }}
                    className="w-full min-w-0 border-0 bg-transparent p-0 text-[22px] font-bold text-[var(--red-500)] focus:outline-none focus:ring-0"
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-[var(--muted)]">Editável (recalcula parcelas)</p>
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">Montante Total</p>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-[13px] text-[var(--muted)]">R$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={totalAmountInput}
                    onFocus={() => setFocusedSummaryField('total')}
                    onChange={(event) => setTotalAmountInput(event.target.value.replace(/[^\d.,]/g, ''))}
                    onBlur={(event) => {
                      setFocusedSummaryField(null)
                      handleRecalculateFromTotal(parseAmount(event.target.value))
                    }}
                    className="w-full min-w-0 border-0 bg-transparent p-0 text-[22px] font-bold text-[var(--ink)] focus:outline-none focus:ring-0"
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-[var(--muted)]">Editável (recalcula parcelas)</p>
              </div>
            </div>

            <div className="flex max-h-[600px] flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
              <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3.5">
                <h3 className="text-[13.5px] font-bold text-[var(--ink)]">Prévia das Parcelas</h3>
                <span className="text-[11.5px] italic text-[var(--muted)]">
                  Datas e valores editáveis individualmente
                </span>
              </div>

              <div className="flex-1 overflow-auto">
                {previewList.length === 0 ? (
                  <p className="px-5 py-10 text-center text-[13px] text-[var(--muted)]">
                    Preencha o valor principal e as parcelas pra gerar a prévia.
                  </p>
                ) : (
                  <table className="w-full border-collapse text-[13px]">
                    <thead className="sticky top-0 bg-[var(--page)]">
                      <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                        <th className="py-2.5 pl-5 pr-2">Nº</th>
                        <th className="px-2 py-2.5">Data Vencimento</th>
                        <th className="px-2 py-2.5 pr-5 text-right">Valor (R$)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewList.map((item, index) => (
                        <tr key={item.number} className="border-t border-[var(--border)]">
                          <td className="py-2 pl-5 pr-2 font-semibold text-[var(--ink)]">{item.number}</td>
                          <td className="px-2 py-1.5">
                            <input
                              type="date"
                              value={item.date}
                              onChange={(event) => {
                                const updated = previewList.map((row, i) =>
                                  i === index ? { ...row, date: event.target.value } : row
                                )
                                setPreviewList(updated)
                              }}
                              className="w-full rounded-lg bg-[var(--page)] px-2.5 py-1.5 text-[13px] text-[var(--ink)] ring-1 ring-transparent focus:outline-none focus:ring-[var(--blue-300)]"
                            />
                          </td>
                          <td className="px-2 py-1.5 pr-5">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={item.amount}
                              onChange={(event) => {
                                const updated = previewList.map((row, i) =>
                                  i === index ? { ...row, amount: parseAmount(event.target.value) } : row
                                )
                                setPreviewList(updated)
                              }}
                              onBlur={() => handleUpdateFromTable(previewList)}
                              className="w-full rounded-lg bg-[var(--page)] px-2.5 py-1.5 text-right font-semibold text-[var(--ink)] ring-1 ring-transparent focus:outline-none focus:ring-[var(--blue-300)]"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
