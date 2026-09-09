import { useEffect, useMemo, useState } from 'react'
import { createSale, fetchSale, VEHICLE_RENTAL_STATUS_LABELS, type SaleRecord } from '../lib/sales'
import { FORM_PAYMENT_LABELS } from '../lib/bills'
import { addDaysToDate, addPeriodsToDate, buildPeriodPlots, rentalUnitsLabel } from '../lib/rentalPlots'
import { formatCurrency, formatDate } from '../lib/format'
import { ApiError } from '../lib/api'
import { useMyCompanyPerson } from '../hooks/useMyCompanyPerson'
import { SelectField } from './form/SelectField'
import { CloseIcon, RefreshIcon, WalletIcon } from './icons'
import type { AuthSession, AuthCompany } from '../lib/auth'

interface RenewRentalModalProps {
  open: boolean
  session: AuthSession
  company: AuthCompany
  sale: SaleRecord | null
  onClose: () => void
  onSuccess: (message: string) => void
}

function frequencyUnitLabel(frequency: string): string {
  if (frequency === 'daily') return 'dias'
  if (frequency === 'weekly') return 'semanas'
  return 'meses'
}

function parseAmount(value: string): number {
  if (!value) return 0
  const normalized = value.includes(',') ? value.replace(/\./g, '').replace(',', '.') : value
  const num = Number(normalized)
  return Number.isNaN(num) ? 0 : num
}

export function RenewRentalModal({ open, session, company, sale, onClose, onSuccess }: RenewRentalModalProps) {
  const myPerson = useMyCompanyPerson(session, company)

  const [detail, setDetail] = useState<SaleRecord | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [quantity, setQuantity] = useState('1')
  const [ratePerPeriod, setRatePerPeriod] = useState('')
  const [formPayment, setFormPayment] = useState(9)
  const [newStartDate, setNewStartDate] = useState('')
  const [pickupOdometerInput, setPickupOdometerInput] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !sale) return
    setDetail(null)
    setLoadError(null)
    setError(null)
    setQuantity('1')
    setFormPayment(9)
    setLoadingDetail(true)

    fetchSale(session.token.token, sale.id)
      .then((full) => {
        const contract = full.vehicleRentalContract
        setDetail(full)
        setRatePerPeriod(contract?.monthlyValue ? String(contract.monthlyValue) : '')
        setNewStartDate(contract?.endDate ? addDaysToDate(contract.endDate.slice(0, 10), 1) : '')
        const odometer = contract?.returnOdometer ?? contract?.pickupOdometer
        setPickupOdometerInput(odometer ? String(odometer) : '')
      })
      .catch((err) => {
        setLoadError(err instanceof ApiError ? err.message : 'Não foi possível carregar o aluguel.')
      })
      .finally(() => {
        setLoadingDetail(false)
      })
  }, [open, sale, session.token.token])

  const contract = detail?.vehicleRentalContract

  const quantityNum = Number(quantity) || 0
  const rate = parseAmount(ratePerPeriod)
  const newEndDate = useMemo(() => {
    if (!contract || !newStartDate || quantityNum <= 0) return ''
    return addPeriodsToDate(contract.rentalFrequency, newStartDate, quantityNum)
  }, [contract, newStartDate, quantityNum])

  const plotsPreview = useMemo(() => {
    if (!contract || !newStartDate || !newEndDate || !rate) return []
    return buildPeriodPlots(contract.rentalFrequency, newStartDate, newEndDate, rate)
  }, [contract, newStartDate, newEndDate, rate])

  const previewTotal = plotsPreview.reduce((sum, plot) => sum + plot.amount, 0)

  if (!open || !sale) return null

  async function handleSubmit() {
    if (!detail || !contract) return
    setError(null)

    if (contract.purchaseOption) return

    if (quantityNum <= 0) {
      setError('Informe por quantos períodos deseja renovar.')
      return
    }
    if (!rate) {
      setError('Informe o valor por período.')
      return
    }
    if (!newStartDate) {
      setError('Informe a data de início do novo período.')
      return
    }
    if (!detail.category_id) {
      setError('Este aluguel não tem categoria definida — edite-o e defina uma categoria antes de renovar.')
      return
    }
    if (!myPerson) {
      setError('Carregando usuário responsável — tente novamente em instantes.')
      return
    }

    setSubmitting(true)
    try {
      await createSale(session.token.token, {
        companyId: company.id,
        peopleId: contract.renter?.id || detail.people_id || '',
        vehicleId: contract.vehicle?.id || detail.vehicle_id || '',
        userId: myPerson.id,
        categoryId: detail.category_id,
        role: 1,
        status: 3,
        net_total: previewTotal,
        note: `Renovação do aluguel #${detail.internal_code ?? detail.code}`,
        vehicleRentalContract: {
          vehicleId: contract.vehicle?.id,
          renterPeopleId: contract.renter?.id,
          ownerPeopleId: contract.vehicleOwnerType === 1 ? contract.owner?.id : undefined,
          driverPeopleId: contract.driver?.id,
          rentalTypeId: contract.rentalTypeId || undefined,
          vehicleOwnerType: contract.vehicleOwnerType,
          startDate: newStartDate,
          endDate: newEndDate,
          billingDay: contract.billingDay || undefined,
          rentalFrequency: contract.rentalFrequency,
          monthlyValue: rate,
          pickupOdometer: pickupOdometerInput ? Number(pickupOdometerInput) : undefined,
        },
        plots: plotsPreview.map((plot) => ({
          portion: plot.portion,
          form_payment: formPayment,
          date_due: plot.dateDue,
          amount: plot.amount,
          status: 0,
        })),
      })
      onSuccess(`Aluguel renovado com sucesso: novo período de ${formatDate(newStartDate)} a ${formatDate(newEndDate)}.`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível renovar o aluguel.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={submitting ? undefined : onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-[560px] flex-col overflow-hidden rounded-2xl bg-[var(--surface)] shadow-[var(--card-shadow)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--blue-100)] text-[var(--blue-700)]">
              <RefreshIcon className="h-4.5 w-4.5" />
            </span>
            <div>
              <h2 className="text-[15px] font-bold text-[var(--ink)]">Renovar aluguel</h2>
              <p className="text-[12.5px] text-[var(--ink-soft)]">
                #{sale.internal_code ?? sale.code} · {sale.vehicleRentalContract?.renter?.name || '—'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--page)] hover:text-[var(--ink)] disabled:opacity-60"
            aria-label="Fechar"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loadingDetail ? (
            <div className="flex flex-col gap-2.5">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-11 animate-pulse rounded-xl bg-[var(--page)]" />
              ))}
            </div>
          ) : loadError ? (
            <p className="rounded-xl bg-[var(--red-100)] px-4 py-3 text-[13px] font-medium text-[var(--red-500)]">
              {loadError}
            </p>
          ) : contract?.purchaseOption ? (
            <p className="rounded-xl bg-[var(--amber-100)] px-4 py-3 text-[13px] font-semibold text-[var(--amber-500)]">
              Este aluguel tem opção de compra (financiamento do veículo com parcelas fixas) — não faz sentido
              renovar nesse modelo.
            </p>
          ) : contract ? (
            <div className="flex flex-col gap-4">
              <p className="text-[12.5px] text-[var(--ink-soft)]">
                Período atual: {formatDate(contract.startDate)} a {formatDate(contract.endDate)} (
                {VEHICLE_RENTAL_STATUS_LABELS[contract.status] ?? '—'})
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-semibold text-[var(--ink-soft)]">
                    Renovar por quantos {frequencyUnitLabel(contract.rentalFrequency)}?
                  </span>
                  <input
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value.replace(/[^\d]/g, ''))}
                    className="min-w-0 w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Valor por período</span>
                  <div className="flex items-center gap-2 rounded-xl bg-[var(--page)] px-3.5 py-2.5 ring-1 ring-transparent transition focus-within:ring-[var(--blue-300)]">
                    <WalletIcon className="h-4 w-4 flex-none text-[var(--muted)]" />
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={ratePerPeriod}
                      onChange={(event) => setRatePerPeriod(event.target.value.replace(/[^\d.,]/g, ''))}
                      className="min-w-0 w-full bg-[var(--page)] text-[14px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none"
                    />
                  </div>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Início do novo período</span>
                  <input
                    type="date"
                    value={newStartDate}
                    onChange={(event) => setNewStartDate(event.target.value)}
                    className="min-w-0 w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                  />
                </label>
                <SelectField
                  label="Forma de pagamento das parcelas"
                  value={formPayment}
                  onChange={(event) => setFormPayment(Number(event.target.value))}
                >
                  {Object.entries(FORM_PAYMENT_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </SelectField>
                <div className="sm:col-span-2">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Odômetro de saída (opcional)</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="KM do veículo"
                      value={pickupOdometerInput}
                      onChange={(event) => setPickupOdometerInput(event.target.value.replace(/\D/g, ''))}
                      className="min-w-0 w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                    />
                  </label>
                </div>
              </div>

              {plotsPreview.length > 0 && (
                <div className="rounded-xl bg-[var(--blue-100)] px-4 py-3">
                  <p className="text-[13px] font-bold text-[var(--blue-700)]">
                    Novo período: {formatDate(newStartDate)} a {formatDate(newEndDate)}
                  </p>
                  <p className="mt-1 text-[12.5px] text-[var(--blue-700)]">
                    {rentalUnitsLabel(contract.rentalFrequency, plotsPreview.length)} de {formatCurrency(rate)} = Total{' '}
                    {formatCurrency(previewTotal)}
                  </p>
                </div>
              )}
            </div>
          ) : null}

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
          {contract && !contract.purchaseOption && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || loadingDetail}
              className="rounded-xl bg-[var(--blue-500)] px-5 py-2.5 text-[13.5px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:opacity-60"
            >
              {submitting ? 'Renovando…' : 'Renovar aluguel'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
