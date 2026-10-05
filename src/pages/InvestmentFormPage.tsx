import { useEffect, useState } from 'react'
import { MoneyInput } from '../components/form/MoneyInput'
import {
  createInvestment,
  updateInvestment,
  fetchInvestment,
  markInvestmentInstallment,
  addInvestmentEntry,
  deleteInvestmentEntry,
  INVESTMENT_TYPE_LABELS,
  PROPERTY_TYPES,
  type InvestmentPayload,
  type InvestmentRecord,
} from '../lib/investments'
import { ApiError } from '../lib/api'
import { formatCurrency, formatDate } from '../lib/format'
import { ChevronLeftIcon, TrashIcon } from '../components/icons'
import type { AuthSession, AuthCompany } from '../lib/auth'

interface InvestmentFormPageProps {
  session: AuthSession
  company: AuthCompany
  investmentId?: string
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

const ENTRY_TYPE_LABELS: Record<string, string> = {
  aporte: 'Aporte adicional',
  custo: 'Custo / despesa',
  retorno: 'Retorno recebido',
}

export function InvestmentFormPage({ session, company, investmentId, onBack, onSaved }: InvestmentFormPageProps) {
  const token = session.token.token
  const [loading, setLoading] = useState(Boolean(investmentId))
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [current, setCurrent] = useState<InvestmentRecord | null>(null)

  const [name, setName] = useState('')
  const [type, setType] = useState('aplicacao_financeira')
  const [status, setStatus] = useState<'ativo' | 'encerrado'>('ativo')
  const [startDate, setStartDate] = useState(todayISO())
  const [investedAmount, setInvestedAmount] = useState('')
  const [currentAmount, setCurrentAmount] = useState('')
  const [counterparty, setCounterparty] = useState('')
  const [expectedReturn, setExpectedReturn] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')

  const [registrationNumber, setRegistrationNumber] = useState('')
  const [notaryOffice, setNotaryOffice] = useState('')
  const [iptuRegistration, setIptuRegistration] = useState('')
  const [propertyType, setPropertyType] = useState('')
  const [address, setAddress] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [city, setCity] = useState('')
  const [zipCode, setZipCode] = useState('')
  const [area, setArea] = useState('')

  const [installmentCount, setInstallmentCount] = useState('0')
  const [interestRate, setInterestRate] = useState('')
  const [interestPeriod, setInterestPeriod] = useState<'mes' | 'ano'>('mes')
  const [interestSystem, setInterestSystem] = useState<'price' | 'simples'>('price')
  const [firstDueDate, setFirstDueDate] = useState('')

  const [endDate, setEndDate] = useState('')
  const [redemptionAmount, setRedemptionAmount] = useState('')

  const [entryDate, setEntryDate] = useState(todayISO())
  const [entryType, setEntryType] = useState('retorno')
  const [entryDescription, setEntryDescription] = useState('')
  const [entryAmount, setEntryAmount] = useState('')
  const [entryBusy, setEntryBusy] = useState(false)
  const [entryError, setEntryError] = useState<string | null>(null)

  const isImovel = PROPERTY_TYPES.includes(type)
  const hasPaidInstallment = (current?.installments || []).some((i) => i.paid)

  useEffect(() => {
    if (!investmentId) return
    let cancelled = false
    setLoading(true)
    setLoadError(null)

    fetchInvestment(token, investmentId)
      .then((investment) => {
        if (cancelled) return
        setCurrent(investment)
        setName(investment.name ?? '')
        setType(investment.type ?? 'aplicacao_financeira')
        setStatus(investment.status ?? 'ativo')
        setStartDate(investment.start_date ? investment.start_date.slice(0, 10) : todayISO())
        setInvestedAmount(String(investment.invested_amount ?? ''))
        setCurrentAmount(investment.current_amount != null ? String(investment.current_amount) : '')
        setCounterparty(investment.counterparty ?? '')
        setExpectedReturn(investment.expected_return ?? '')
        setDueDate(investment.due_date ? investment.due_date.slice(0, 10) : '')
        setNotes(investment.notes ?? '')

        setRegistrationNumber(investment.registration_number ?? '')
        setNotaryOffice(investment.notary_office ?? '')
        setIptuRegistration(investment.iptu_registration ?? '')
        setPropertyType(investment.property_type ?? '')
        setAddress(investment.address ?? '')
        setNeighborhood(investment.neighborhood ?? '')
        setCity(investment.city ?? '')
        setZipCode(investment.zip_code ?? '')
        setArea(investment.area != null ? String(investment.area) : '')

        setInstallmentCount(String(investment.installment_count ?? (investment.installments || []).length ?? 0))
        setInterestRate(investment.interest_rate != null ? String(investment.interest_rate) : '')
        setInterestPeriod((investment.interest_period as 'mes' | 'ano') ?? 'mes')
        setInterestSystem((investment.interest_system as 'price' | 'simples') ?? 'price')
        setFirstDueDate(investment.first_due_date ? investment.first_due_date.slice(0, 10) : '')

        setEndDate(investment.end_date ? investment.end_date.slice(0, 10) : '')
        setRedemptionAmount(investment.redemption_amount != null ? String(investment.redemption_amount) : '')
      })
      .catch((err) => {
        if (cancelled) return
        setLoadError(err instanceof ApiError ? err.message : 'Não foi possível carregar o investimento.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [investmentId, token, reloadKey])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Informe o nome do investimento.')
      return
    }
    const invested = parseAmount(investedAmount)
    if (!invested) {
      setError('Informe o valor investido.')
      return
    }

    setSubmitting(true)
    try {
      const payload: InvestmentPayload = {
        company_id: company.id,
        name: name.trim(),
        type,
        status,
        start_date: startDate,
        invested_amount: invested,
        current_amount: currentAmount ? parseAmount(currentAmount) : undefined,
        counterparty: counterparty.trim() || undefined,
        expected_return: expectedReturn.trim() || undefined,
        due_date: dueDate || undefined,
        notes: notes.trim() || undefined,

        registration_number: isImovel ? registrationNumber.trim() || undefined : undefined,
        notary_office: isImovel ? notaryOffice.trim() || undefined : undefined,
        iptu_registration: isImovel ? iptuRegistration.trim() || undefined : undefined,
        property_type: isImovel ? propertyType || undefined : undefined,
        address: isImovel ? address.trim() || undefined : undefined,
        neighborhood: isImovel ? neighborhood.trim() || undefined : undefined,
        city: isImovel ? city.trim() || undefined : undefined,
        zip_code: isImovel ? zipCode.trim() || undefined : undefined,
        area: isImovel && area ? parseAmount(area) : undefined,

        installment_count: hasPaidInstallment ? undefined : Number(installmentCount) || 0,
        interest_rate: hasPaidInstallment ? undefined : interestRate ? parseAmount(interestRate) : undefined,
        interest_period: hasPaidInstallment ? undefined : interestPeriod,
        interest_system: hasPaidInstallment ? undefined : interestSystem,
        first_due_date: hasPaidInstallment ? undefined : firstDueDate || undefined,

        end_date: status === 'encerrado' ? endDate || undefined : undefined,
        redemption_amount: status === 'encerrado' && redemptionAmount ? parseAmount(redemptionAmount) : undefined,
      }

      if (investmentId) {
        await updateInvestment(token, investmentId, payload)
        setReloadKey((k) => k + 1)
      } else {
        await createInvestment(token, payload)
        onSaved()
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar o investimento.')
    } finally {
      setSubmitting(false)
    }
  }

  async function togglePaid(installmentId: string, paid: boolean) {
    try {
      await markInvestmentInstallment(token, installmentId, paid)
      setReloadKey((k) => k + 1)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível atualizar a parcela.')
    }
  }

  async function handleAddEntry() {
    if (!investmentId) return
    const amount = parseAmount(entryAmount)
    if (!amount) {
      setEntryError('Informe o valor do lançamento.')
      return
    }
    setEntryBusy(true)
    setEntryError(null)
    try {
      await addInvestmentEntry(token, {
        company_id: company.id,
        investment_id: investmentId,
        entry_date: entryDate,
        type: entryType,
        description: entryDescription.trim() || undefined,
        amount,
      })
      setEntryAmount('')
      setEntryDescription('')
      setReloadKey((k) => k + 1)
    } catch (err) {
      setEntryError(err instanceof ApiError ? err.message : 'Não foi possível lançar a movimentação.')
    } finally {
      setEntryBusy(false)
    }
  }

  async function handleDeleteEntry(entryId: string) {
    try {
      await deleteInvestmentEntry(token, entryId)
      setReloadKey((k) => k + 1)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível excluir a movimentação.')
    }
  }

  const entries = current?.entries || []
  const installments = current?.installments || []
  const aportesAdicionais = entries.filter((e) => e.type === 'aporte').reduce((a, e) => a + Number(e.amount), 0)
  const custos = entries.filter((e) => e.type === 'custo').reduce((a, e) => a + Number(e.amount), 0)
  const retornos = entries.filter((e) => e.type === 'retorno').reduce((a, e) => a + Number(e.amount), 0)
  const parcelasPagas = installments.filter((i) => i.paid).reduce((a, i) => a + Number(i.amount), 0)
  const totalAplicado = parseAmount(investedAmount || '0') + aportesAdicionais + custos
  const totalRecebido = retornos + parcelasPagas
  const valorFinal =
    status === 'encerrado'
      ? parseAmount(redemptionAmount || '0')
      : currentAmount
        ? parseAmount(currentAmount)
        : totalAplicado
  const resultado = totalRecebido + valorFinal - totalAplicado

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div>
        <button
          type="button"
          onClick={onBack}
          className="mb-3 flex items-center gap-1 text-[12.5px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]"
        >
          <ChevronLeftIcon className="h-3.5 w-3.5" />
          Voltar para Investimentos
        </button>
        <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Investimentos</p>
        <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">
          {investmentId ? 'Editar investimento' : 'Novo investimento'}
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
        <>
          {investmentId && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">Total aplicado</p>
                <p className="mt-1 text-[16px] font-bold text-[var(--ink)]">{formatCurrency(totalAplicado)}</p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">Retornos recebidos</p>
                <p className="mt-1 text-[16px] font-bold text-[var(--ink)]">{formatCurrency(totalRecebido)}</p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">
                  {status === 'encerrado' ? 'Valor de resgate' : 'Valor atual'}
                </p>
                <p className="mt-1 text-[16px] font-bold text-[var(--ink)]">{formatCurrency(valorFinal)}</p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">Resultado</p>
                <p className={`mt-1 text-[16px] font-bold ${resultado >= 0 ? 'text-[var(--green-600)]' : 'text-[var(--red-500)]'}`}>
                  {formatCurrency(resultado)}
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
              <h2 className="mb-4 text-[14px] font-bold text-[var(--ink)]">Dados do investimento</h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <label className="flex flex-col gap-1.5 sm:col-span-2 xl:col-span-1">
                  <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Nome / descrição</span>
                  <input
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Apartamento Águas Claras, empréstimo ao João…"
                    className="w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Tipo</span>
                  <select
                    value={type}
                    onChange={(event) => setType(event.target.value)}
                    className="w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                  >
                    {Object.entries(INVESTMENT_TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Situação</span>
                  <select
                    value={status}
                    onChange={(event) => setStatus(event.target.value as 'ativo' | 'encerrado')}
                    className="w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                  >
                    <option value="ativo">Ativo</option>
                    <option value="encerrado">Encerrado</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Data do investimento</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                    className="w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Valor investido (R$)</span>
                  <MoneyInput
                    placeholder="0,00"
                    value={investedAmount}
                    onChange={(event) => setInvestedAmount(event.target.value.replace(/[^\d.,]/g, ''))}
                    className="w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Valor atual estimado (R$)</span>
                  <MoneyInput
                    placeholder="igual ao investido"
                    value={currentAmount}
                    onChange={(event) => setCurrentAmount(event.target.value.replace(/[^\d.,]/g, ''))}
                    className="w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Contraparte</span>
                  <input
                    type="text"
                    value={counterparty}
                    onChange={(event) => setCounterparty(event.target.value)}
                    placeholder="Banco, sócio, devedor, inquilino…"
                    className="w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Rendimento esperado</span>
                  <input
                    type="text"
                    value={expectedReturn}
                    onChange={(event) => setExpectedReturn(event.target.value)}
                    placeholder="2% a.m., aluguel R$ 2.500/mês…"
                    className="w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Vencimento / prazo</span>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(event) => setDueDate(event.target.value)}
                    className="w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                  />
                </label>
              </div>
              <label className="mt-4 flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Observações</span>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={2}
                  className="w-full resize-none rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                />
              </label>
            </div>

            {isImovel && (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
                <h2 className="mb-4 text-[14px] font-bold text-[var(--ink)]">Dados do imóvel</h2>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Matrícula</span>
                    <input
                      type="text"
                      value={registrationNumber}
                      onChange={(event) => setRegistrationNumber(event.target.value)}
                      className="w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Cartório de Registro de Imóveis</span>
                    <input
                      type="text"
                      value={notaryOffice}
                      onChange={(event) => setNotaryOffice(event.target.value)}
                      className="w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Inscrição do IPTU</span>
                    <input
                      type="text"
                      value={iptuRegistration}
                      onChange={(event) => setIptuRegistration(event.target.value)}
                      className="w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Tipo de imóvel</span>
                    <input
                      type="text"
                      value={propertyType}
                      onChange={(event) => setPropertyType(event.target.value)}
                      placeholder="Casa, apartamento, sala comercial…"
                      className="w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 sm:col-span-2">
                    <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Endereço</span>
                    <input
                      type="text"
                      value={address}
                      onChange={(event) => setAddress(event.target.value)}
                      className="w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Bairro / setor</span>
                    <input
                      type="text"
                      value={neighborhood}
                      onChange={(event) => setNeighborhood(event.target.value)}
                      className="w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Cidade / UF</span>
                    <input
                      type="text"
                      value={city}
                      onChange={(event) => setCity(event.target.value)}
                      className="w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-semibold text-[var(--ink-soft)]">CEP</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={zipCode}
                      onChange={(event) => setZipCode(event.target.value)}
                      className="w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Área (m²)</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={area}
                      onChange={(event) => setArea(event.target.value.replace(/[^\d.,]/g, ''))}
                      className="w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                    />
                  </label>
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
              <h2 className="mb-1 text-[14px] font-bold text-[var(--ink)]">Parcelas e taxa de juros</h2>
              {hasPaidInstallment ? (
                <p className="text-[12.5px] text-[var(--muted)]">
                  Este investimento já tem parcelas recebidas, então o parcelamento não pode ser refeito aqui.
                </p>
              ) : (
                <>
                  <p className="mb-4 text-[12.5px] text-[var(--muted)]">
                    Use para empréstimos, vendas a prazo ou qualquer investimento que volte em parcelas. Deixe 0 parcelas
                    se não houver.
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    <label className="flex flex-col gap-1.5">
                      <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Nº de parcelas</span>
                      <input
                        type="number"
                        min={0}
                        max={480}
                        value={installmentCount}
                        onChange={(event) => setInstallmentCount(event.target.value)}
                        className="w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                      />
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Taxa de juros (%)</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0"
                        value={interestRate}
                        onChange={(event) => setInterestRate(event.target.value.replace(/[^\d.,]/g, ''))}
                        className="w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                      />
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Período da taxa</span>
                      <select
                        value={interestPeriod}
                        onChange={(event) => setInterestPeriod(event.target.value as 'mes' | 'ano')}
                        className="w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                      >
                        <option value="mes">ao mês</option>
                        <option value="ano">ao ano</option>
                      </select>
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Cálculo</span>
                      <select
                        value={interestSystem}
                        onChange={(event) => setInterestSystem(event.target.value as 'price' | 'simples')}
                        className="w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                      >
                        <option value="price">Juros compostos (Price)</option>
                        <option value="simples">Juros simples</option>
                      </select>
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-[12px] font-semibold text-[var(--ink-soft)]">1º vencimento</span>
                      <input
                        type="date"
                        value={firstDueDate}
                        onChange={(event) => setFirstDueDate(event.target.value)}
                        className="w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                      />
                    </label>
                  </div>
                </>
              )}
            </div>

            {status === 'encerrado' && (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
                <h2 className="mb-4 text-[14px] font-bold text-[var(--ink)]">Encerramento</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Data de encerramento</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(event) => setEndDate(event.target.value)}
                      className="w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Valor de venda / resgate (R$)</span>
                    <MoneyInput
                      value={redemptionAmount}
                      onChange={(event) => setRedemptionAmount(event.target.value.replace(/[^\d.,]/g, ''))}
                      className="w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                    />
                  </label>
                </div>
              </div>
            )}

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
                {submitting ? 'Salvando…' : investmentId ? 'Salvar alterações' : 'Salvar investimento'}
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

          {investmentId && installments.length > 0 && (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
              <h2 className="mb-4 text-[14px] font-bold text-[var(--ink)]">
                Parcelas · {installments.filter((i) => i.paid).length} de {installments.length} recebidas
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-left text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                      <th className="pb-2.5">Parcela</th>
                      <th className="pb-2.5">Vencimento</th>
                      <th className="pb-2.5 text-right">Valor</th>
                      <th className="pb-2.5">Situação</th>
                      <th className="pb-2.5 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {installments.map((installment) => (
                      <tr key={installment.id} className="border-b border-[var(--border)] last:border-none">
                        <td className="py-2.5">
                          {installment.number}/{installments.length}
                        </td>
                        <td className="py-2.5">{formatDate(installment.due_date)}</td>
                        <td className="py-2.5 text-right font-mono">{formatCurrency(Number(installment.amount))}</td>
                        <td className="py-2.5">
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                              installment.paid
                                ? 'bg-[var(--green-100)] text-[var(--green-600)]'
                                : 'bg-[var(--page)] text-[var(--muted)]'
                            }`}
                          >
                            {installment.paid ? 'Recebida' : 'A receber'}
                          </span>
                        </td>
                        <td className="py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => togglePaid(installment.id, !installment.paid)}
                            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-[12px] font-semibold text-[var(--ink-soft)] hover:bg-[var(--page)]"
                          >
                            {installment.paid ? 'Desfazer' : 'Recebida'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {investmentId && (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
              <h2 className="mb-4 text-[14px] font-bold text-[var(--ink)]">Movimentações</h2>
              {entries.length > 0 ? (
                <div className="mb-4 overflow-x-auto">
                  <table className="w-full border-collapse text-[13px]">
                    <thead>
                      <tr className="border-b border-[var(--border)] text-left text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                        <th className="pb-2.5">Data</th>
                        <th className="pb-2.5">Tipo</th>
                        <th className="pb-2.5">Descrição</th>
                        <th className="pb-2.5 text-right">Valor</th>
                        <th className="pb-2.5 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((entry) => (
                        <tr key={entry.id} className="border-b border-[var(--border)] last:border-none">
                          <td className="py-2.5">{formatDate(entry.entry_date)}</td>
                          <td className="py-2.5">{ENTRY_TYPE_LABELS[entry.type] || entry.type}</td>
                          <td className="py-2.5">{entry.description || ''}</td>
                          <td
                            className={`py-2.5 text-right font-mono ${entry.type === 'retorno' ? 'text-[var(--green-600)]' : ''}`}
                          >
                            {formatCurrency(Number(entry.amount))}
                          </td>
                          <td className="py-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => handleDeleteEntry(entry.id)}
                              className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--red-100)] hover:text-[var(--red-500)]"
                              aria-label="Excluir"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mb-4 text-[12.5px] text-[var(--muted)]">
                  Lance aqui o que entra (aluguéis, juros, dividendos) e o que sai (novos aportes, IPTU, condomínio,
                  taxas).
                </p>
              )}
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Data</span>
                  <input
                    type="date"
                    value={entryDate}
                    onChange={(event) => setEntryDate(event.target.value)}
                    className="w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Tipo</span>
                  <select
                    value={entryType}
                    onChange={(event) => setEntryType(event.target.value)}
                    className="w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                  >
                    {Object.entries(ENTRY_TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Descrição</span>
                  <input
                    type="text"
                    value={entryDescription}
                    onChange={(event) => setEntryDescription(event.target.value)}
                    placeholder="Aluguel de outubro"
                    className="w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Valor (R$)</span>
                  <MoneyInput
                    value={entryAmount}
                    onChange={(event) => setEntryAmount(event.target.value.replace(/[^\d.,]/g, ''))}
                    className="w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                  />
                </label>
              </div>
              {entryError && <p className="mt-2 text-[12.5px] font-medium text-[var(--red-500)]">{entryError}</p>}
              <button
                type="button"
                onClick={handleAddEntry}
                disabled={entryBusy}
                className="mt-3 rounded-xl bg-[var(--blue-500)] px-4 py-2 text-[13px] font-bold text-white hover:bg-[var(--blue-700)] disabled:opacity-60"
              >
                {entryBusy ? 'Lançando…' : 'Lançar'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
