import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  createSale,
  fetchSale,
  updateSale,
  VEHICLE_SALE_STATUS_LABELS,
  type SaleRecord,
  type SalePlotPayload,
} from '../lib/sales'
import { fetchPeople, type PersonRecord } from '../lib/people'
import { fetchVehicles, type VehicleRecord } from '../lib/vehicles'
import { fetchBills, FORM_PAYMENT_LABELS } from '../lib/bills'
import { fetchCategories, type CategoryRecord } from '../lib/categories'
import { formatDocument } from '../lib/formatDocument'
import { formatCurrency } from '../lib/format'
import { ApiError } from '../lib/api'
import { TextField } from '../components/form/TextField'
import { SelectField } from '../components/form/SelectField'
import { SearchSelectField } from '../components/form/SearchSelectField'
import { UserIcon, WalletIcon, PlusIcon, TrashIcon, ChevronLeftIcon } from '../components/icons'
import { SectionCard } from '../components/SectionCard'
import { useMyCompanyPerson } from '../hooks/useMyCompanyPerson'
import type { AuthSession, AuthCompany } from '../lib/auth'

interface PlotEntry {
  tempId: string
  portion: number
  dateDue: string
  amount: string
  status: number
}

interface VehicleSaleFormPageProps {
  session: AuthSession
  company: AuthCompany
  saleId?: string
  onBack: () => void
  onSaved: () => void
}

interface PersonPick {
  id: string
  label: string
  sub?: string
}

function parseAmount(value: string): number {
  if (!value) return 0
  const normalized = value.includes(',') ? value.replace(/\./g, '').replace(',', '.') : value
  const num = Number(normalized)
  return Number.isNaN(num) ? 0 : num
}

export function VehicleSaleFormPage({ session, company, saleId, onBack, onSaved }: VehicleSaleFormPageProps) {
  const [loading, setLoading] = useState(Boolean(saleId))
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [buyer, setBuyer] = useState<PersonPick | null>(null)
  const [vehicle, setVehicle] = useState<PersonPick | null>(null)
  const [witnessOne, setWitnessOne] = useState<PersonPick | null>(null)
  const [witnessTwo, setWitnessTwo] = useState<PersonPick | null>(null)
  const [guarantor, setGuarantor] = useState<PersonPick | null>(null)
  const [responsible, setResponsible] = useState<PersonPick | null>(null)
  const myCompanyPerson = useMyCompanyPerson(session, company)

  const [saleValue, setSaleValue] = useState('')
  const [downPayment, setDownPayment] = useState('')
  const [installmentCount, setInstallmentCount] = useState('')
  const [firstDueDate, setFirstDueDate] = useState('')
  const [status, setStatus] = useState(0)
  const [notes, setNotes] = useState('')

  const [categoryId, setCategoryId] = useState('')
  const [categories, setCategories] = useState<CategoryRecord[]>([])
  const [plotsFormPayment, setPlotsFormPayment] = useState(9)
  const [plots, setPlots] = useState<PlotEntry[]>([])
  const [plotsLoading, setPlotsLoading] = useState(false)

  const hasInstallments = Number(installmentCount || 0) > 0

  useEffect(() => {
    if (saleId || !myCompanyPerson) return
    setResponsible((current) => current ?? { id: myCompanyPerson.id, label: myCompanyPerson.name })
  }, [saleId, myCompanyPerson])

  useEffect(() => {
    let cancelled = false
    fetchCategories(session.token.token, company.id, { role: 1, limit: 200 })
      .then((res) => {
        if (!cancelled) setCategories(res.data || [])
      })
      .catch(() => {
        if (!cancelled) setCategories([])
      })
    return () => {
      cancelled = true
    }
  }, [session.token.token, company.id])

  useEffect(() => {
    if (!saleId) return
    let cancelled = false
    setLoading(true)
    setLoadError(null)

    fetchSale(session.token.token, saleId)
      .then((sale: SaleRecord) => {
        if (cancelled) return
        const contract = sale.vehicleSaleContract
        setBuyer(contract?.buyer ? { id: contract.buyer.id, label: contract.buyer.name, sub: contract.buyer.document ?? undefined } : null)
        setVehicle(
          sale.vehicle
            ? { id: sale.vehicle.id, label: [sale.vehicle.brand, sale.vehicle.model].filter(Boolean).join(' '), sub: sale.vehicle.license_plate ?? undefined }
            : null
        )
        setWitnessOne(contract?.witnessOne ? { id: contract.witnessOne.id, label: contract.witnessOne.name } : null)
        setWitnessTwo(contract?.witnessTwo ? { id: contract.witnessTwo.id, label: contract.witnessTwo.name } : null)
        setGuarantor(contract?.guarantor ? { id: contract.guarantor.id, label: contract.guarantor.name, sub: contract.guarantor.document ?? undefined } : null)
        setResponsible(sale.user ? { id: sale.user.id, label: sale.user.name } : null)
        setSaleValue(contract?.saleValue ? String(contract.saleValue) : '')
        setDownPayment(contract?.downPayment ? String(contract.downPayment) : '')
        setInstallmentCount(contract?.installmentCount ? String(contract.installmentCount) : '')
        setFirstDueDate(contract?.firstDueDate ? contract.firstDueDate.slice(0, 10) : '')
        setStatus(contract?.status ?? 0)
        setNotes(contract?.notes ?? '')
        setCategoryId(sale.category_id ?? '')

        if (contract?.installmentCount && contract.installmentCount > 0) {
          setPlotsLoading(true)
          fetchBills(session.token.token, company.id, { role: 1, limit: 200, saleId })
            .then((res) => {
              if (cancelled) return
              const loaded = (res.data || [])
                .slice()
                .sort((a, b) => (a.installment_number ?? 0) - (b.installment_number ?? 0))
                .map((bill) => ({
                  tempId: bill.id,
                  portion: bill.installment_number ?? 0,
                  dateDue: bill.date_due ? bill.date_due.slice(0, 10) : '',
                  amount: bill.amount ? String(bill.amount) : '',
                  status: bill.status ?? 0,
                }))
              setPlots(loaded)
            })
            .catch(() => {
              if (!cancelled) setPlots([])
            })
            .finally(() => {
              if (!cancelled) setPlotsLoading(false)
            })
        }
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

  const searchPeople = useCallback(
    (query: string) => fetchPeople(session.token.token, company.id, { search: query, limit: 8 }).then((res) => res.data),
    [session.token.token, company.id]
  )
  const searchVehicles = useCallback(
    (query: string) => fetchVehicles(session.token.token, company.id, { search: query, limit: 8 }).then((res) => res.data),
    [session.token.token, company.id]
  )

  const installmentValue = useMemo(() => {
    const count = Number(installmentCount || 0)
    if (count <= 0) return 0
    const remaining = parseAmount(saleValue) - parseAmount(downPayment)
    return remaining > 0 ? remaining / count : 0
  }, [saleValue, downPayment, installmentCount])

  const plotsTotal = useMemo(() => plots.reduce((sum, plot) => sum + parseAmount(plot.amount), 0), [plots])

  function addMonthsToDate(dateStr: string, months: number): string {
    const date = new Date(dateStr)
    date.setMonth(date.getMonth() + months)
    return date.toISOString().slice(0, 10)
  }

  function handleGeneratePlots() {
    const count = Number(installmentCount || 0)
    if (count <= 0) {
      setError('Preencha o nº de parcelas para gerar as parcelas.')
      return
    }
    const baseDate = firstDueDate || new Date().toISOString().slice(0, 10)
    const perInstallment = installmentValue
    const generated: PlotEntry[] = Array.from({ length: count }).map((_, index) => ({
      tempId: `plot-${Date.now()}-${index}`,
      portion: index + 1,
      dateDue: index === 0 ? baseDate : addMonthsToDate(baseDate, index),
      amount: perInstallment ? String(perInstallment.toFixed(2)) : '',
      status: 0,
    }))
    setPlots(generated)
  }

  function handleAddPlot() {
    const last = plots[plots.length - 1]
    setPlots((prev) => [
      ...prev,
      {
        tempId: `plot-${Date.now()}-${prev.length}`,
        portion: prev.length + 1,
        dateDue: last ? addMonthsToDate(last.dateDue, 1) : firstDueDate || new Date().toISOString().slice(0, 10),
        amount: '',
        status: 0,
      },
    ])
  }

  function handleUpdatePlot(tempId: string, patch: Partial<PlotEntry>) {
    setPlots((prev) => prev.map((plot) => (plot.tempId === tempId ? { ...plot, ...patch } : plot)))
  }

  function handleRemovePlot(tempId: string) {
    setPlots((prev) => prev.filter((plot) => plot.tempId !== tempId).map((plot, index) => ({ ...plot, portion: index + 1 })))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (!buyer) {
      setError('Selecione o comprador para continuar.')
      return
    }
    if (!vehicle) {
      setError('Selecione o veículo para continuar.')
      return
    }
    if (!responsible) {
      setError('Selecione o responsável para continuar.')
      return
    }
    if (hasInstallments && plots.length > 0 && !categoryId) {
      setError('Selecione a categoria para lançar as parcelas.')
      return
    }

    const plotsPayload: SalePlotPayload[] | undefined =
      hasInstallments && plots.length > 0
        ? plots.map((plot, index) => ({
            portion: index + 1,
            form_payment: plotsFormPayment,
            date_due: plot.dateDue,
            amount: parseAmount(plot.amount),
            status: plot.status,
          }))
        : undefined

    const payload = {
      companyId: company.id,
      peopleId: buyer.id,
      vehicleId: vehicle.id,
      userId: responsible.id,
      categoryId: hasInstallments ? categoryId || undefined : undefined,
      role: 1,
      status: 3,
      net_total: saleValue ? parseAmount(saleValue) : undefined,
      vehicleSaleContract: {
        vehicleId: vehicle.id,
        buyerPeopleId: buyer.id,
        witnessOnePeopleId: witnessOne?.id,
        witnessTwoPeopleId: witnessTwo?.id,
        guarantorPeopleId: guarantor?.id,
        saleValue: saleValue ? parseAmount(saleValue) : undefined,
        downPayment: downPayment ? parseAmount(downPayment) : undefined,
        installmentValue: installmentValue || undefined,
        installmentCount: installmentCount ? Number(installmentCount) : undefined,
        firstDueDate: firstDueDate || undefined,
        notes: notes || undefined,
        status,
      },
      plots: plotsPayload,
    }

    setSubmitting(true)
    try {
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

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div>
        <button
          type="button"
          onClick={onBack}
          className="mb-3 flex items-center gap-1 text-[12.5px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]"
        >
          <ChevronLeftIcon className="h-3.5 w-3.5" />
          Voltar para venda de veículos
        </button>
        <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Principal</p>
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
          <SectionCard title="Venda">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <SearchSelectField
                label="Comprador"
                placeholder="Buscar por nome ou documento"
                selectedLabel={buyer?.label ?? null}
                selectedSubLabel={buyer?.sub ? formatDocument(buyer.sub) : undefined}
                onSearch={searchPeople}
                getOptionLabel={(item: PersonRecord) => item.name}
                getOptionSubLabel={(item: PersonRecord) => (item.document ? formatDocument(item.document) : undefined)}
                onSelect={(item: PersonRecord) => setBuyer({ id: item.id, label: item.name, sub: item.document ?? undefined })}
                onClear={() => setBuyer(null)}
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
                onSearch={searchPeople}
                getOptionLabel={(item: PersonRecord) => item.name}
                onSelect={(item: PersonRecord) => setResponsible({ id: item.id, label: item.name })}
                onClear={() => setResponsible(null)}
              />
              <SearchSelectField
                label="Testemunha 1"
                placeholder="Opcional"
                selectedLabel={witnessOne?.label ?? null}
                onSearch={searchPeople}
                getOptionLabel={(item: PersonRecord) => item.name}
                onSelect={(item: PersonRecord) => setWitnessOne({ id: item.id, label: item.name })}
                onClear={() => setWitnessOne(null)}
              />
              <SearchSelectField
                label="Testemunha 2"
                placeholder="Opcional"
                selectedLabel={witnessTwo?.label ?? null}
                onSearch={searchPeople}
                getOptionLabel={(item: PersonRecord) => item.name}
                onSelect={(item: PersonRecord) => setWitnessTwo({ id: item.id, label: item.name })}
                onClear={() => setWitnessTwo(null)}
              />
              <SearchSelectField
                label="Fiador"
                placeholder="Opcional"
                selectedLabel={guarantor?.label ?? null}
                selectedSubLabel={guarantor?.sub ? formatDocument(guarantor.sub) : undefined}
                onSearch={searchPeople}
                getOptionLabel={(item: PersonRecord) => item.name}
                getOptionSubLabel={(item: PersonRecord) => (item.document ? formatDocument(item.document) : undefined)}
                onSelect={(item: PersonRecord) => setGuarantor({ id: item.id, label: item.name, sub: item.document ?? undefined })}
                onClear={() => setGuarantor(null)}
              />
            </div>
          </SectionCard>

          <SectionCard title="Condições da venda">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <TextField
                label="Valor da venda"
                icon={<WalletIcon className="h-4 w-4" />}
                placeholder="0,00"
                inputMode="decimal"
                value={saleValue}
                onChange={(event) => setSaleValue(event.target.value.replace(/[^\d.,]/g, ''))}
              />
              <TextField
                label="Entrada"
                icon={<WalletIcon className="h-4 w-4" />}
                placeholder="0,00"
                inputMode="decimal"
                value={downPayment}
                onChange={(event) => setDownPayment(event.target.value.replace(/[^\d.,]/g, ''))}
              />
              <TextField
                label="Nº de parcelas"
                icon={<UserIcon className="h-4 w-4" />}
                placeholder="Ex: 12"
                inputMode="numeric"
                value={installmentCount}
                onChange={(event) => setInstallmentCount(event.target.value.replace(/\D/g, ''))}
              />
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Data da 1ª parcela</span>
                <input
                  type="date"
                  value={firstDueDate}
                  onChange={(event) => setFirstDueDate(event.target.value)}
                  className="min-w-0 w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                />
              </label>
              <div className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Valor da parcela (sugerido)</span>
                <div className="flex items-center rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] font-semibold text-[var(--ink-soft)]">
                  {formatCurrency(installmentValue)}
                </div>
              </div>
              <SelectField label="Status" value={status} onChange={(event) => setStatus(Number(event.target.value))}>
                {Object.entries(VEHICLE_SALE_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </SelectField>
            </div>
          </SectionCard>

          {hasInstallments && (
            <SectionCard
              title="Parcelas"
              subtitle="Valor individual de cada parcela — cada uma pode ter um valor diferente"
              headerExtra={
                <span className="flex-none text-[13.5px] font-bold text-[var(--ink)]">
                  Total: {formatCurrency(plotsTotal)}
                </span>
              }
            >
              <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <SelectField label="Categoria" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                  <option value="">Selecione</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </SelectField>
                <SelectField
                  label="Forma de pagamento"
                  value={plotsFormPayment}
                  onChange={(event) => setPlotsFormPayment(Number(event.target.value))}
                >
                  {Object.entries(FORM_PAYMENT_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </SelectField>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={handleGeneratePlots}
                    className="w-full rounded-xl border border-[var(--border)] px-4 py-2.5 text-[13px] font-bold text-[var(--ink-soft)] hover:border-[var(--blue-500)] hover:text-[var(--blue-700)]"
                  >
                    Gerar {installmentCount || 'N'} parcelas iguais
                  </button>
                </div>
              </div>

              {plotsLoading ? (
                <div className="flex flex-col gap-2">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="h-11 animate-pulse rounded-xl bg-[var(--page)]" />
                  ))}
                </div>
              ) : plots.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--page)] px-4 py-6 text-center text-[12.5px] text-[var(--muted)]">
                  Nenhuma parcela cadastrada. Use "Gerar parcelas iguais" ou adicione manualmente.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {plots.map((plot) => (
                    <div key={plot.tempId} className="flex flex-wrap items-center gap-2 rounded-xl bg-[var(--page)] px-3.5 py-2.5">
                      <span className="w-9 flex-none text-[12.5px] font-bold text-[var(--ink-soft)]">#{plot.portion}</span>
                      <input
                        type="date"
                        value={plot.dateDue}
                        onChange={(event) => handleUpdatePlot(plot.tempId, { dateDue: event.target.value })}
                        className="min-w-0 flex-1 rounded-lg bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--ink)] ring-1 ring-transparent focus:outline-none focus:ring-[var(--blue-300)]"
                      />
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0,00"
                        value={plot.amount}
                        onChange={(event) => handleUpdatePlot(plot.tempId, { amount: event.target.value.replace(/[^\d.,]/g, '') })}
                        className="min-w-0 flex-1 rounded-lg bg-[var(--surface)] px-3 py-2 text-right text-[13px] font-semibold text-[var(--ink)] ring-1 ring-transparent focus:outline-none focus:ring-[var(--blue-300)]"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemovePlot(plot.tempId)}
                        className="flex-none rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--red-100)] hover:text-[var(--red-500)]"
                        aria-label="Remover parcela"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={handleAddPlot}
                className="mt-4 flex items-center gap-1.5 rounded-xl border border-dashed border-[var(--border)] px-4 py-2 text-[12.5px] font-semibold text-[var(--ink-soft)] hover:border-[var(--blue-500)] hover:text-[var(--blue-700)]"
              >
                <PlusIcon className="h-3.5 w-3.5" />
                Adicionar parcela
              </button>
            </SectionCard>
          )}

          <SectionCard title="Observações" defaultCollapsed>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Opcional"
              rows={3}
              className="w-full resize-none rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition placeholder:text-[var(--muted)] focus:outline-none focus:ring-[var(--blue-300)]"
            />
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
