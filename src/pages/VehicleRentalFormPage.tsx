import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  createSale,
  fetchSale,
  updateSale,
  RENTAL_FREQUENCY_LABELS,
  VEHICLE_OWNER_TYPE_LABELS,
  VEHICLE_RENTAL_STATUS_LABELS,
  type SaleRecord,
  type SalePlotPayload,
} from '../lib/sales'
import { fetchPeople, type PersonRecord } from '../lib/people'
import { fetchVehicles, type VehicleRecord } from '../lib/vehicles'
import { fetchBills, FORM_PAYMENT_LABELS } from '../lib/bills'
import { fetchCategories, type CategoryRecord } from '../lib/categories'
import { fetchRentalTypes, type RentalTypeRecord } from '../lib/rentalTypes'
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

interface VehicleRentalFormPageProps {
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

// Mesma lógica de VehicleRentalsPage.tsx (rentalUnits) — quantas diárias/
// semanas/meses cabem entre início e fim, pra multiplicar pelo valor por
// período e chegar no total real da locação.
function rentalUnitsLabel(frequency: string, units: number): string {
  if (frequency === 'daily') return `${units} ${units === 1 ? 'diária' : 'diárias'}`
  if (frequency === 'weekly') return `${units} ${units === 1 ? 'semana' : 'semanas'}`
  return `${units} ${units === 1 ? 'mês' : 'meses'}`
}

function computeRentalUnits(frequency: string, startDateStr: string, endDateStr: string): number {
  const start = new Date(startDateStr)
  const end = new Date(endDateStr)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return 1

  const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))

  if (frequency === 'daily') return Math.max(1, diffDays)
  if (frequency === 'weekly') return Math.max(1, Math.ceil(diffDays / 7))
  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
  if (end.getDate() < start.getDate()) months -= 1
  return Math.max(1, months)
}

export function VehicleRentalFormPage({ session, company, saleId, onBack, onSaved }: VehicleRentalFormPageProps) {
  const [loading, setLoading] = useState(Boolean(saleId))
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [renter, setRenter] = useState<PersonPick | null>(null)
  const [vehicle, setVehicle] = useState<PersonPick | null>(null)
  const [owner, setOwner] = useState<PersonPick | null>(null)
  const [driver, setDriver] = useState<PersonPick | null>(null)
  const [responsible, setResponsible] = useState<PersonPick | null>(null)
  const myCompanyPerson = useMyCompanyPerson(session, company)

  const [vehicleOwnerType, setVehicleOwnerType] = useState(0)
  const [rentalFrequency, setRentalFrequency] = useState('monthly')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [billingDay, setBillingDay] = useState('')
  const [monthlyValue, setMonthlyValue] = useState('')
  const [securityDeposit, setSecurityDeposit] = useState('')
  const [purchaseOption, setPurchaseOption] = useState(false)
  const [installmentCount, setInstallmentCount] = useState('')
  const [vehicleTotalValue, setVehicleTotalValue] = useState('')
  const [status, setStatus] = useState(0)
  const [notes, setNotes] = useState('')

  const [categoryId, setCategoryId] = useState('')
  const [categories, setCategories] = useState<CategoryRecord[]>([])
  const [rentalTypeId, setRentalTypeId] = useState('')
  const [rentalTypes, setRentalTypes] = useState<RentalTypeRecord[]>([])
  const [plotsFormPayment, setPlotsFormPayment] = useState(9)
  const [plots, setPlots] = useState<PlotEntry[]>([])
  const [plotsLoading, setPlotsLoading] = useState(false)
  // Parâmetros do aluguel no momento em que as parcelas foram carregadas ou
  // regeneradas pela última vez — usado só na edição, pra avisar quando
  // data/frequência/valor mudaram depois disso e as parcelas pendentes podem
  // estar desatualizadas.
  const [plotsBaseline, setPlotsBaseline] = useState<{
    startDate: string
    endDate: string
    rentalFrequency: string
    monthlyValue: string
  } | null>(null)

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
    let cancelled = false
    fetchRentalTypes(session.token.token, company.id, { limit: 200 })
      .then((res) => {
        if (!cancelled) setRentalTypes(res.data || [])
      })
      .catch(() => {
        if (!cancelled) setRentalTypes([])
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
        const contract = sale.vehicleRentalContract
        setRenter(contract?.renter ? { id: contract.renter.id, label: contract.renter.name, sub: contract.renter.document ?? undefined } : null)
        setVehicle(
          sale.vehicle
            ? { id: sale.vehicle.id, label: [sale.vehicle.brand, sale.vehicle.model].filter(Boolean).join(' '), sub: sale.vehicle.license_plate ?? undefined }
            : null
        )
        setOwner(contract?.owner ? { id: contract.owner.id, label: contract.owner.name, sub: contract.owner.document ?? undefined } : null)
        setDriver(contract?.driver ? { id: contract.driver.id, label: contract.driver.name, sub: contract.driver.document ?? undefined } : null)
        setResponsible(sale.user ? { id: sale.user.id, label: sale.user.name } : null)
        setVehicleOwnerType(contract?.vehicleOwnerType ?? 0)
        setRentalFrequency(contract?.rentalFrequency ?? 'monthly')
        setStartDate(contract?.startDate ? contract.startDate.slice(0, 10) : '')
        setEndDate(contract?.endDate ? contract.endDate.slice(0, 10) : '')
        setBillingDay(contract?.billingDay ? String(contract.billingDay) : '')
        setMonthlyValue(contract?.monthlyValue ? String(contract.monthlyValue) : '')
        setSecurityDeposit(contract?.securityDeposit ? String(contract.securityDeposit) : '')
        setPurchaseOption(Boolean(contract?.purchaseOption))
        setInstallmentCount(contract?.installmentCount ? String(contract.installmentCount) : '')
        setVehicleTotalValue(contract?.vehicleTotalValue ? String(contract.vehicleTotalValue) : '')
        setStatus(contract?.status ?? 0)
        setNotes(contract?.notes ?? '')
        setCategoryId(sale.category_id ?? '')
        setRentalTypeId(contract?.rentalTypeId ?? '')

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
            setPlotsBaseline({
              startDate: contract?.startDate ? contract.startDate.slice(0, 10) : '',
              endDate: contract?.endDate ? contract.endDate.slice(0, 10) : '',
              rentalFrequency: contract?.rentalFrequency ?? 'monthly',
              monthlyValue: contract?.monthlyValue ? String(contract.monthlyValue) : '',
            })
          })
          .catch(() => {
            if (!cancelled) setPlots([])
          })
          .finally(() => {
            if (!cancelled) setPlotsLoading(false)
          })
      })
      .catch((err) => {
        if (cancelled) return
        setLoadError(err instanceof ApiError ? err.message : 'Não foi possível carregar o aluguel.')
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

  // Em aluguel com opção de compra, sugere o valor da parcela (valor total /
  // nº de parcelas) só como ponto de partida — sem sobrescrever se o usuário
  // já preencheu ou editou o campo manualmente.
  useEffect(() => {
    if (!purchaseOption || monthlyValue) return
    const count = Number(installmentCount || 0)
    if (count <= 0 || !vehicleTotalValue) return
    const computed = parseAmount(vehicleTotalValue) / count
    if (computed) setMonthlyValue(computed.toFixed(2))
  }, [purchaseOption, installmentCount, vehicleTotalValue, monthlyValue])

  const plotsTotal = useMemo(() => plots.reduce((sum, plot) => sum + parseAmount(plot.amount), 0), [plots])

  const rentalDayCount = useMemo(() => {
    if (!startDate || !endDate) return null
    const start = new Date(startDate)
    const end = new Date(endDate)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return null
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  }, [startDate, endDate])

  // Mesma conta usada no cálculo do net_total no submit: nº de períodos ×
  // valor por período = total da locação. Mostrado aqui só como conferência
  // pro usuário — não roda quando há opção de compra (aí o total vem das
  // parcelas/valor do veículo, não dessa multiplicação).
  const rentalUnitsCalc = useMemo(() => {
    if (purchaseOption || rentalDayCount === null) return null
    const rate = monthlyValue ? parseAmount(monthlyValue) : 0
    if (!rate) return null
    const units = computeRentalUnits(rentalFrequency, startDate, endDate)
    return { units, rate, total: units * rate }
  }, [purchaseOption, rentalDayCount, monthlyValue, rentalFrequency, startDate, endDate])

  function addMonthsToDate(dateStr: string, months: number): string {
    const date = new Date(dateStr)
    date.setMonth(date.getMonth() + months)
    return date.toISOString().slice(0, 10)
  }

  function addDaysToDate(dateStr: string, days: number): string {
    const date = new Date(dateStr)
    date.setDate(date.getDate() + days)
    return date.toISOString().slice(0, 10)
  }

  function nextDueDate(baseDate: string, index: number): string {
    if (rentalFrequency === 'daily') return addDaysToDate(baseDate, index)
    if (rentalFrequency === 'weekly') return addDaysToDate(baseDate, index * 7)
    return addMonthsToDate(baseDate, index)
  }

  // Uma conta por período (diária/semanal/mensal, conforme rentalFrequency) — a
  // 1ª vence na própria data de início (índice 0-based), diferente do fluxo de
  // financiamento acima (handleGeneratePlots), que só cobra a 1ª parcela um
  // período depois.
  function buildPeriodPlots(): PlotEntry[] {
    const rate = parseAmount(monthlyValue)
    const units = computeRentalUnits(rentalFrequency, startDate, endDate)
    return Array.from({ length: units }).map((_, index) => ({
      tempId: `plot-${Date.now()}-${index}`,
      portion: index + 1,
      dateDue: nextDueDate(startDate, index),
      amount: rate ? rate.toFixed(2) : '',
      status: 0,
    }))
  }

  // Recalcula só as parcelas pendentes a partir da data/frequência/valor
  // atuais — as já recebidas ficam intocadas (não é possível "desfazer" um
  // pagamento por aqui) e a contagem continua depois delas, não do zero.
  function handleRegeneratePeriodPlots() {
    if (!startDate || !endDate) {
      setError('Preencha as datas de início e término para gerar as contas.')
      return
    }
    const rate = parseAmount(monthlyValue)
    if (!rate) {
      setError('Preencha o valor para gerar as contas.')
      return
    }

    const received = plots.filter((plot) => plot.status === 1)
    const totalUnits = computeRentalUnits(rentalFrequency, startDate, endDate)

    if (received.length > totalUnits) {
      setError(
        `Já existem ${received.length} conta(s) recebida(s), mas o novo período só permite ${totalUnits}. Ajuste as datas ou o valor antes de atualizar.`
      )
      return
    }

    const pending: PlotEntry[] = Array.from({ length: totalUnits - received.length }).map((_, index) => {
      const portion = received.length + index + 1
      return {
        tempId: `plot-${Date.now()}-${index}`,
        portion,
        dateDue: nextDueDate(startDate, portion - 1),
        amount: rate.toFixed(2),
        status: 0,
      }
    })

    setPlots([...received, ...pending])
    setPlotsBaseline({ startDate, endDate, rentalFrequency, monthlyValue })
    setError(null)
  }

  const plotsOutOfSync = Boolean(
    saleId &&
      !purchaseOption &&
      plotsBaseline &&
      (plotsBaseline.startDate !== startDate ||
        plotsBaseline.endDate !== endDate ||
        plotsBaseline.rentalFrequency !== rentalFrequency ||
        plotsBaseline.monthlyValue !== monthlyValue)
  )

  // Gera as contas a receber automaticamente pra aluguel novo (sem opção de
  // compra) — segue os campos ao vivo até o usuário salvar. Na edição, quem
  // regenera é o botão acima; aqui não mexe pra não descartar contas já
  // carregadas do backend (algumas podem estar recebidas).
  useEffect(() => {
    if (saleId || purchaseOption) return
    if (!startDate || !endDate || !parseAmount(monthlyValue)) return
    setPlots(buildPeriodPlots())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saleId, purchaseOption, startDate, endDate, rentalFrequency, monthlyValue])

  function handleGeneratePlots() {
    const count = Number(installmentCount || 0)
    if (count <= 0) {
      setError('Preencha o nº de parcelas para gerar as parcelas.')
      return
    }
    const baseDate = startDate || new Date().toISOString().slice(0, 10)
    const perInstallment = parseAmount(monthlyValue)
    const generated: PlotEntry[] = Array.from({ length: count }).map((_, index) => ({
      tempId: `plot-${Date.now()}-${index}`,
      portion: index + 1,
      dateDue: nextDueDate(baseDate, index + 1),
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
        dateDue: last ? nextDueDate(last.dateDue, 1) : startDate || new Date().toISOString().slice(0, 10),
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

    if (!renter) {
      setError('Selecione o locatário para continuar.')
      return
    }
    if (!vehicle) {
      setError('Selecione o veículo para continuar.')
      return
    }
    if (vehicleOwnerType === 1 && !owner) {
      setError('Selecione o proprietário do veículo de terceiro.')
      return
    }
    if (!responsible) {
      setError('Selecione o responsável para continuar.')
      return
    }
    if (plots.length > 0 && !categoryId) {
      setError('Selecione a categoria para lançar as parcelas.')
      return
    }

    const periodValue = monthlyValue ? parseAmount(monthlyValue) : undefined

    // net_total é o valor TOTAL da locação (o que aparece como "Total a
    // pagar" no contrato e nos relatórios) — não pode ser só o valor de um
    // período isolado. Em locação simples é valor-por-período × nº de
    // períodos entre início e fim; com opção de compra, é a soma das
    // parcelas (ou o valor total do veículo, se as parcelas ainda não
    // foram geradas).
    let netTotal = periodValue
    if (purchaseOption) {
      if (plots.length > 0) {
        netTotal = plotsTotal
      } else if (vehicleTotalValue) {
        netTotal = parseAmount(vehicleTotalValue)
      }
    } else if (periodValue !== undefined && startDate && endDate) {
      netTotal = periodValue * computeRentalUnits(rentalFrequency, startDate, endDate)
    }

    const plotsPayload: SalePlotPayload[] | undefined =
      plots.length > 0
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
      peopleId: renter.id,
      vehicleId: vehicle.id,
      userId: responsible.id,
      categoryId: categoryId || undefined,
      role: 1,
      status: 3,
      net_total: netTotal,
      vehicleRentalContract: {
        vehicleId: vehicle.id,
        renterPeopleId: renter.id,
        ownerPeopleId: vehicleOwnerType === 1 ? owner?.id : undefined,
        driverPeopleId: driver?.id,
        rentalTypeId: rentalTypeId || undefined,
        vehicleOwnerType,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        billingDay: billingDay ? Number(billingDay) : undefined,
        rentalFrequency,
        monthlyValue: periodValue,
        securityDeposit: securityDeposit ? parseAmount(securityDeposit) : undefined,
        purchaseOption,
        installmentCount: purchaseOption && installmentCount ? Number(installmentCount) : undefined,
        vehicleTotalValue: purchaseOption && vehicleTotalValue ? parseAmount(vehicleTotalValue) : undefined,
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
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar o aluguel.')
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
          Voltar para aluguel de veículos
        </button>
        <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Principal</p>
        <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">
          {saleId ? 'Editar aluguel' : 'Novo aluguel'}
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
          <SectionCard title="Locação">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <SearchSelectField
                label="Locatário"
                placeholder="Buscar por nome ou documento"
                selectedLabel={renter?.label ?? null}
                selectedSubLabel={renter?.sub ? formatDocument(renter.sub) : undefined}
                onSearch={searchPeople}
                getOptionLabel={(item: PersonRecord) => item.name}
                getOptionSubLabel={(item: PersonRecord) => (item.document ? formatDocument(item.document) : undefined)}
                onSelect={(item: PersonRecord) => setRenter({ id: item.id, label: item.name, sub: item.document ?? undefined })}
                onClear={() => setRenter(null)}
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
              <SelectField
                label="Veículo pertence a"
                value={vehicleOwnerType}
                onChange={(event) => setVehicleOwnerType(Number(event.target.value))}
              >
                {Object.entries(VEHICLE_OWNER_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </SelectField>
              {vehicleOwnerType === 1 && (
                <SearchSelectField
                  label="Proprietário"
                  placeholder="Buscar por nome ou documento"
                  selectedLabel={owner?.label ?? null}
                  selectedSubLabel={owner?.sub ? formatDocument(owner.sub) : undefined}
                  onSearch={searchPeople}
                  getOptionLabel={(item: PersonRecord) => item.name}
                  getOptionSubLabel={(item: PersonRecord) => (item.document ? formatDocument(item.document) : undefined)}
                  onSelect={(item: PersonRecord) => setOwner({ id: item.id, label: item.name, sub: item.document ?? undefined })}
                  onClear={() => setOwner(null)}
                />
              )}
              <SearchSelectField
                label="Condutor"
                placeholder="Opcional"
                selectedLabel={driver?.label ?? null}
                selectedSubLabel={driver?.sub ? formatDocument(driver.sub) : undefined}
                onSearch={searchPeople}
                getOptionLabel={(item: PersonRecord) => item.name}
                getOptionSubLabel={(item: PersonRecord) => (item.document ? formatDocument(item.document) : undefined)}
                onSelect={(item: PersonRecord) => setDriver({ id: item.id, label: item.name, sub: item.document ?? undefined })}
                onClear={() => setDriver(null)}
              />
            </div>
          </SectionCard>

          <SectionCard title="Condições do aluguel">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <SelectField label="Tipo de aluguel" value={rentalTypeId} onChange={(event) => setRentalTypeId(event.target.value)}>
                <option value="">Nenhum</option>
                {rentalTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </SelectField>
              <SelectField label="Frequência" value={rentalFrequency} onChange={(event) => setRentalFrequency(event.target.value)}>
                {Object.entries(RENTAL_FREQUENCY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </SelectField>
              <TextField
                label={purchaseOption ? 'Valor da parcela' : 'Valor'}
                icon={<WalletIcon className="h-4 w-4" />}
                placeholder="0,00"
                inputMode="decimal"
                value={monthlyValue}
                onChange={(event) => setMonthlyValue(event.target.value.replace(/[^\d.,]/g, ''))}
              />
              <TextField
                label="Caução"
                icon={<WalletIcon className="h-4 w-4" />}
                placeholder="0,00"
                inputMode="decimal"
                value={securityDeposit}
                onChange={(event) => setSecurityDeposit(event.target.value.replace(/[^\d.,]/g, ''))}
              />
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Data de início</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="min-w-0 w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Data de término</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="min-w-0 w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                />
              </label>
              {rentalDayCount !== null && (
                <div className="flex items-end sm:col-span-2 xl:col-span-1">
                  <span className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--blue-100)] px-3.5 py-2.5 text-[13px] font-semibold text-[var(--blue-700)]">
                    {rentalUnitsCalc
                      ? `${rentalUnitsLabel(rentalFrequency, rentalUnitsCalc.units)} × ${formatCurrency(rentalUnitsCalc.rate)} = ${formatCurrency(rentalUnitsCalc.total)}`
                      : `${rentalDayCount} ${rentalDayCount === 1 ? 'dia' : 'dias'} de locação`}
                  </span>
                </div>
              )}
              <TextField
                label="Dia de cobrança"
                icon={<UserIcon className="h-4 w-4" />}
                placeholder="Ex: 5"
                inputMode="numeric"
                value={billingDay}
                onChange={(event) => setBillingDay(event.target.value.replace(/\D/g, '').slice(0, 2))}
              />
              <SelectField label="Status" value={status} onChange={(event) => setStatus(Number(event.target.value))}>
                {Object.entries(VEHICLE_RENTAL_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </SelectField>
            </div>

            <label className="mt-4 flex items-center gap-2.5 text-[13.5px] font-semibold text-[var(--ink)]">
              <input
                type="checkbox"
                checked={purchaseOption}
                onChange={(event) => setPurchaseOption(event.target.checked)}
                className="h-4 w-4 accent-[var(--blue-500)]"
              />
              Aluguel com opção de compra
            </label>

            {purchaseOption && (
              <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <TextField
                  label="Nº de parcelas"
                  icon={<UserIcon className="h-4 w-4" />}
                  placeholder="Ex: 24"
                  inputMode="numeric"
                  value={installmentCount}
                  onChange={(event) => setInstallmentCount(event.target.value.replace(/\D/g, ''))}
                />
                <TextField
                  label="Valor total do veículo"
                  icon={<WalletIcon className="h-4 w-4" />}
                  placeholder="0,00"
                  inputMode="decimal"
                  value={vehicleTotalValue}
                  onChange={(event) => setVehicleTotalValue(event.target.value.replace(/[^\d.,]/g, ''))}
                />
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Parcelas"
            subtitle={
              purchaseOption
                ? 'Valor individual de cada parcela do financiamento — cada uma pode ter um valor diferente'
                : 'Uma conta a receber por período de locação, gerada automaticamente'
            }
            headerExtra={
              <span className="flex-none text-[13.5px] font-bold text-[var(--ink)]">
                Total: {formatCurrency(plotsTotal)}
              </span>
            }
          >
            {plotsOutOfSync && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[var(--amber-100)] px-4 py-3">
                <p className="text-[12.5px] font-semibold text-[var(--amber-500)]">
                  A data, frequência ou valor mudaram desde que as parcelas foram geradas. As contas já recebidas não
                  são alteradas — só as pendentes são recalculadas a partir de agora.
                </p>
                <button
                  type="button"
                  onClick={handleRegeneratePeriodPlots}
                  className="flex-none rounded-lg bg-[var(--amber-500)] px-3.5 py-2 text-[12.5px] font-bold text-white hover:opacity-90"
                >
                  Atualizar parcelas pendentes
                </button>
              </div>
            )}
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
                {purchaseOption ? (
                  <button
                    type="button"
                    onClick={handleGeneratePlots}
                    className="w-full rounded-xl border border-[var(--border)] px-4 py-2.5 text-[13px] font-bold text-[var(--ink-soft)] hover:border-[var(--blue-500)] hover:text-[var(--blue-700)]"
                  >
                    Gerar {installmentCount || 'N'} parcelas iguais
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleRegeneratePeriodPlots}
                    className="w-full rounded-xl border border-[var(--border)] px-4 py-2.5 text-[13px] font-bold text-[var(--ink-soft)] hover:border-[var(--blue-500)] hover:text-[var(--blue-700)]"
                  >
                    Atualizar parcelas pendentes
                  </button>
                )}
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
                {purchaseOption
                  ? 'Nenhuma parcela cadastrada. Use "Gerar parcelas iguais" ou adicione manualmente.'
                  : 'Preencha as datas e o valor pra gerar as contas automaticamente.'}
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {plots.map((plot) => {
                  const received = plot.status === 1
                  return (
                    <div key={plot.tempId} className="flex flex-wrap items-center gap-2 rounded-xl bg-[var(--page)] px-3.5 py-2.5">
                      <span className="w-9 flex-none text-[12.5px] font-bold text-[var(--ink-soft)]">#{plot.portion}</span>
                      <input
                        type="date"
                        value={plot.dateDue}
                        disabled={received}
                        onChange={(event) => handleUpdatePlot(plot.tempId, { dateDue: event.target.value })}
                        className="min-w-0 flex-1 rounded-lg bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--ink)] ring-1 ring-transparent focus:outline-none focus:ring-[var(--blue-300)] disabled:opacity-60"
                      />
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0,00"
                        value={plot.amount}
                        disabled={received}
                        onChange={(event) => handleUpdatePlot(plot.tempId, { amount: event.target.value.replace(/[^\d.,]/g, '') })}
                        className="min-w-0 flex-1 rounded-lg bg-[var(--surface)] px-3 py-2 text-right text-[13px] font-semibold text-[var(--ink)] ring-1 ring-transparent focus:outline-none focus:ring-[var(--blue-300)] disabled:opacity-60"
                      />
                      {received ? (
                        <span className="flex-none rounded-lg bg-[var(--green-100)] px-2.5 py-1 text-[11px] font-bold text-[var(--green-600)]">
                          Recebido
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleRemovePlot(plot.tempId)}
                          className="flex-none rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--red-100)] hover:text-[var(--red-500)]"
                          aria-label="Remover parcela"
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  )
                })}
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
              {submitting ? 'Salvando…' : 'Salvar aluguel'}
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
