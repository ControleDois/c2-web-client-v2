import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  createOrderService,
  fetchOrderService,
  updateOrderService,
  billOrderService,
  ORDER_SERVICE_STATUS_LABELS,
  type OrderServiceRecord,
  type OrderServiceItemPayload,
} from '../lib/orderServices'
import { fetchPeople, type PersonRecord } from '../lib/people'
import { fetchVehicles, type VehicleRecord } from '../lib/vehicles'
import { fetchProducts, type ProductRecord } from '../lib/products'
import { FUEL_LEVEL_OPTIONS } from '../lib/sales'
import { isLocacaoVeiculos } from '../lib/systemTypes'
import { formatDocument } from '../lib/formatDocument'
import { formatCurrency, formatDate } from '../lib/format'
import { ApiError } from '../lib/api'
import { TextField } from '../components/form/TextField'
import { SelectField } from '../components/form/SelectField'
import { SearchSelectField } from '../components/form/SearchSelectField'
import { TrashIcon, ChevronLeftIcon, ChevronDownIcon, ClockIcon } from '../components/icons'
import { SectionCard } from '../components/SectionCard'
import { useMyCompanyPerson } from '../hooks/useMyCompanyPerson'
import type { AuthSession, AuthCompany } from '../lib/auth'

interface ItemEntry {
  tempId: string
  productId: string
  productRole?: number
  description: string
  amount: string
  purchaseCost: string
  marginPercent: string
  costValue: string
  supplierId?: string
  supplierLabel?: string
  note: string
  expanded: boolean
}

interface OrderServiceFormPageProps {
  session: AuthSession
  company: AuthCompany
  orderServiceId?: string
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

function itemTotal(item: ItemEntry): number {
  const total = parseAmount(item.amount) * parseAmount(item.costValue)
  return total > 0 ? total : 0
}

function marginFromCost(purchaseCost: string, costValue: string): string {
  const cost = parseAmount(purchaseCost)
  if (!cost) return ''
  const value = parseAmount(costValue)
  return (((value - cost) / cost) * 100).toFixed(1)
}

function costValueFromMargin(purchaseCost: string, marginPercent: string): string {
  const cost = parseAmount(purchaseCost)
  const margin = parseAmount(marginPercent)
  const value = cost * (1 + margin / 100)
  return value ? value.toFixed(2) : ''
}

export function OrderServiceFormPage({ session, company, orderServiceId, onBack, onSaved }: OrderServiceFormPageProps) {
  const [loading, setLoading] = useState(Boolean(orderServiceId))
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [client, setClient] = useState<PersonPick | null>(null)
  const [vehicle, setVehicle] = useState<PersonPick | null>(null)
  const [responsible, setResponsible] = useState<PersonPick | null>(null)
  const myCompanyPerson = useMyCompanyPerson(session, company)

  const [status, setStatus] = useState(0)
  const [dateStart, setDateStart] = useState(() => new Date().toISOString().slice(0, 10))
  const [dateFinish, setDateFinish] = useState('')
  const [entryMileage, setEntryMileage] = useState('')
  const [entryFuelLevel, setEntryFuelLevel] = useState('')
  const [noteService, setNoteService] = useState('')

  const [items, setItems] = useState<ItemEntry[]>([])
  const [code, setCode] = useState<number | undefined>(undefined)
  const [saleId, setSaleId] = useState<string | null>(null)
  const [saleCode, setSaleCode] = useState<number | undefined>(undefined)
  const [events, setEvents] = useState<OrderServiceRecord['events']>([])
  const [billing, setBilling] = useState(false)
  const [billError, setBillError] = useState<string | null>(null)

  useEffect(() => {
    if (orderServiceId || !myCompanyPerson) return
    setResponsible((current) => current ?? { id: myCompanyPerson.id, label: myCompanyPerson.name })
  }, [orderServiceId, myCompanyPerson])

  useEffect(() => {
    if (!orderServiceId) return
    let cancelled = false
    setLoading(true)
    setLoadError(null)

    fetchOrderService(session.token.token, orderServiceId)
      .then((os: OrderServiceRecord) => {
        if (cancelled) return
        setCode(os.code)
        setClient(os.people ? { id: os.people.id, label: os.people.name, sub: os.people.document ?? undefined } : null)
        setVehicle(
          os.vehicle
            ? { id: os.vehicle.id, label: [os.vehicle.brand, os.vehicle.model].filter(Boolean).join(' '), sub: os.vehicle.license_plate ?? undefined }
            : null
        )
        setResponsible(os.user ? { id: os.user.id, label: os.user.name } : null)
        setStatus(os.status ?? 0)
        setDateStart(os.date_start ? os.date_start.slice(0, 10) : '')
        setDateFinish(os.date_finish ? os.date_finish.slice(0, 10) : '')
        setEntryMileage(os.entryMileage ? String(os.entryMileage) : '')
        setEntryFuelLevel(os.entryFuelLevel ?? '')
        setNoteService(os.note_service ?? '')
        setSaleId(os.saleId ?? null)
        setSaleCode(os.sale?.code)
        setEvents(os.events ?? [])
        setItems(
          (os.items ?? []).map((item, index) => {
            const purchaseCost = item.purchase_cost ? String(item.purchase_cost) : ''
            const costValue = item.cost_value ? String(item.cost_value) : ''
            return {
              tempId: item.id ?? `item-${index}`,
              productId: item.productId,
              productRole: item.product?.role,
              description: item.description || item.product?.name || '',
              amount: item.amount ? String(item.amount) : '1',
              purchaseCost,
              marginPercent: marginFromCost(purchaseCost, costValue),
              costValue,
              supplierId: item.supplier?.id,
              supplierLabel: item.supplier?.name,
              note: item.note ?? '',
              expanded: true,
            }
          })
        )
      })
      .catch((err) => {
        if (cancelled) return
        setLoadError(err instanceof ApiError ? err.message : 'Não foi possível carregar a OS.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [orderServiceId, session.token.token, reloadKey])

  const searchPeople = useCallback(
    (query: string) => fetchPeople(session.token.token, company.id, { search: query, limit: 8 }).then((res) => res.data),
    [session.token.token, company.id]
  )
  const searchVehicles = useCallback(
    (query: string) => fetchVehicles(session.token.token, company.id, { search: query, limit: 8 }).then((res) => res.data),
    [session.token.token, company.id]
  )
  const searchProducts = useCallback(
    (query: string) => fetchProducts(session.token.token, company.id, { search: query, limit: 8 }).then((res) => res.data),
    [session.token.token, company.id]
  )

  const itemsTotal = useMemo(() => items.reduce((sum, item) => sum + itemTotal(item), 0), [items])
  const partsTotal = useMemo(
    () => items.filter((item) => item.productRole !== 1).reduce((sum, item) => sum + itemTotal(item), 0),
    [items]
  )
  const servicesTotal = useMemo(
    () => items.filter((item) => item.productRole === 1).reduce((sum, item) => sum + itemTotal(item), 0),
    [items]
  )

  function handleAddItem(product: ProductRecord) {
    setItems((prev) => [
      {
        tempId: `item-${Date.now()}-${prev.length}`,
        productId: product.id,
        productRole: product.role,
        description: product.name,
        amount: '1',
        purchaseCost: '',
        marginPercent: '',
        costValue: product.sale_value ? String(product.sale_value) : '',
        supplierId: undefined,
        supplierLabel: undefined,
        note: '',
        expanded: false,
      },
      ...prev,
    ])
  }

  function handleUpdateItem(tempId: string, patch: Partial<ItemEntry>) {
    setItems((prev) => prev.map((item) => (item.tempId === tempId ? { ...item, ...patch } : item)))
  }

  function handleCostChange(tempId: string, value: string) {
    setItems((prev) =>
      prev.map((item) =>
        item.tempId === tempId
          ? { ...item, purchaseCost: value, costValue: costValueFromMargin(value, item.marginPercent) || item.costValue }
          : item
      )
    )
  }

  function handleMarginChange(tempId: string, value: string) {
    setItems((prev) =>
      prev.map((item) =>
        item.tempId === tempId
          ? { ...item, marginPercent: value, costValue: costValueFromMargin(item.purchaseCost, value) || item.costValue }
          : item
      )
    )
  }

  function handleCostValueChange(tempId: string, value: string) {
    setItems((prev) =>
      prev.map((item) =>
        item.tempId === tempId ? { ...item, costValue: value, marginPercent: marginFromCost(item.purchaseCost, value) } : item
      )
    )
  }

  function handleRemoveItem(tempId: string) {
    setItems((prev) => prev.filter((item) => item.tempId !== tempId))
  }

  async function handleBill() {
    if (!orderServiceId) return
    setBilling(true)
    setBillError(null)
    try {
      const res = await billOrderService(session.token.token, orderServiceId)
      setSaleId(res.sale.id)
      setSaleCode(res.sale.code)
    } catch (err) {
      setBillError(err instanceof ApiError ? err.message : 'Não foi possível gerar o orçamento.')
    } finally {
      setBilling(false)
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (!responsible) {
      setError('Selecione o responsável para continuar.')
      return
    }

    const itemsPayload: OrderServiceItemPayload[] = items.map((item, index) => ({
      productId: item.productId,
      item: index + 1,
      description: item.description || undefined,
      amount: parseAmount(item.amount) || 1,
      cost_value: parseAmount(item.costValue),
      subtotal: itemTotal(item),
      total: itemTotal(item),
      purchase_cost: item.purchaseCost ? parseAmount(item.purchaseCost) : undefined,
      supplier_people_id: item.supplierId || undefined,
      note: item.note || undefined,
    }))

    const payload = {
      companyId: company.id,
      peopleId: client?.id || undefined,
      userId: responsible.id,
      vehicleId: vehicle?.id || undefined,
      status,
      date_start: dateStart || undefined,
      date_finish: dateFinish || undefined,
      entryMileage: entryMileage ? Number(entryMileage) : undefined,
      entryFuelLevel: entryFuelLevel || undefined,
      note_service: noteService || undefined,
      items: itemsPayload,
    }

    setSubmitting(true)
    try {
      if (orderServiceId) {
        await updateOrderService(session.token.token, orderServiceId, payload)
      } else {
        await createOrderService(session.token.token, payload)
      }
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar a OS.')
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
          Voltar para ordens de serviço
        </button>
        <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Principal</p>
        <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">
          {orderServiceId ? `Editar OS${code ? ` #${code}` : ''}` : 'Nova OS'}
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
          <SectionCard title="Ordem de serviço">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <SearchSelectField
                label="Cliente"
                placeholder="Buscar por nome ou documento"
                selectedLabel={client?.label ?? null}
                selectedSubLabel={client?.sub ? formatDocument(client.sub) : undefined}
                onSearch={searchPeople}
                getOptionLabel={(item: PersonRecord) => item.name}
                getOptionSubLabel={(item: PersonRecord) => (item.document ? formatDocument(item.document) : undefined)}
                onSelect={(item: PersonRecord) => setClient({ id: item.id, label: item.name, sub: item.document ?? undefined })}
                onClear={() => setClient(null)}
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
            </div>
          </SectionCard>

          <SectionCard title="Detalhes do serviço">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <SelectField label="Status" value={status} onChange={(event) => setStatus(Number(event.target.value))}>
                {Object.entries(ORDER_SERVICE_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </SelectField>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Data de início</span>
                <input
                  type="date"
                  value={dateStart}
                  onChange={(event) => setDateStart(event.target.value)}
                  className="min-w-0 w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Previsão de término</span>
                <input
                  type="date"
                  value={dateFinish}
                  onChange={(event) => setDateFinish(event.target.value)}
                  className="min-w-0 w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                />
              </label>
              <TextField
                label="KM de entrada"
                icon={<ClockIcon className="h-4 w-4" />}
                placeholder="Opcional"
                inputMode="numeric"
                value={entryMileage}
                onChange={(event) => setEntryMileage(event.target.value.replace(/\D/g, ''))}
              />
              <SelectField label="Nível de combustível" value={entryFuelLevel} onChange={(event) => setEntryFuelLevel(event.target.value)}>
                <option value="">—</option>
                {FUEL_LEVEL_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </SelectField>
            </div>
          </SectionCard>

          <SectionCard
            title="Serviços e peças"
            headerExtra={
              <div className="flex flex-none items-center gap-4 text-[12.5px] font-semibold text-[var(--ink-soft)]">
                <span>Peças: {formatCurrency(partsTotal)}</span>
                <span>Serviços: {formatCurrency(servicesTotal)}</span>
                <span className="text-[13.5px] font-bold text-[var(--ink)]">Total: {formatCurrency(itemsTotal)}</span>
              </div>
            }
          >
            <div className="mb-4">
              <SearchSelectField
                label="Adicionar produto ou serviço"
                placeholder="Buscar por nome ou código"
                selectedLabel={null}
                onSearch={searchProducts}
                getOptionLabel={(item: ProductRecord) => item.name}
                getOptionSubLabel={(item: ProductRecord) => (item.sale_value ? formatCurrency(item.sale_value) : undefined)}
                onSelect={(item: ProductRecord) => handleAddItem(item)}
                onClear={() => {}}
              />
            </div>

            {items.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--page)] px-4 py-6 text-center text-[12.5px] text-[var(--muted)]">
                Nenhum produto ou serviço adicionado ainda.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {items.map((item) => (
                  <div key={item.tempId} className="rounded-xl bg-[var(--page)] px-3.5 py-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`flex-none rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          item.productRole === 1 ? 'bg-[var(--blue-100)] text-[var(--blue-700)]' : 'bg-[var(--amber-100)] text-[var(--amber-500)]'
                        }`}
                      >
                        {item.productRole === 1 ? 'Serviço' : 'Peça'}
                      </span>
                      <input
                        type="text"
                        value={item.description}
                        onChange={(event) => handleUpdateItem(item.tempId, { description: event.target.value })}
                        className="min-w-[140px] flex-1 rounded-lg bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--ink)] ring-1 ring-transparent focus:outline-none focus:ring-[var(--blue-300)]"
                      />
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="Qtd."
                        title="Quantidade"
                        value={item.amount}
                        onChange={(event) => handleUpdateItem(item.tempId, { amount: event.target.value.replace(/[^\d.,]/g, '') })}
                        className="w-14 flex-none rounded-lg bg-[var(--surface)] px-3 py-2 text-right text-[13px] text-[var(--ink)] ring-1 ring-transparent focus:outline-none focus:ring-[var(--blue-300)]"
                      />
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="Custo"
                        title="Custo"
                        value={item.purchaseCost}
                        onChange={(event) => handleCostChange(item.tempId, event.target.value.replace(/[^\d.,]/g, ''))}
                        className="w-20 flex-none rounded-lg bg-[var(--surface)] px-3 py-2 text-right text-[13px] text-[var(--ink)] ring-1 ring-transparent focus:outline-none focus:ring-[var(--blue-300)]"
                      />
                      <div className="flex w-20 flex-none items-center rounded-lg bg-[var(--surface)] px-3 py-2 ring-1 ring-transparent focus-within:ring-[var(--blue-300)]">
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="Margem"
                          title="Margem (%)"
                          value={item.marginPercent}
                          onChange={(event) => handleMarginChange(item.tempId, event.target.value.replace(/[^\d.,-]/g, ''))}
                          className="min-w-0 flex-1 bg-transparent text-right text-[13px] text-[var(--ink)] focus:outline-none"
                        />
                        <span className="flex-none text-[12px] text-[var(--muted)]">%</span>
                      </div>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="Vl. venda"
                        title="Valor de venda"
                        value={item.costValue}
                        onChange={(event) => handleCostValueChange(item.tempId, event.target.value.replace(/[^\d.,]/g, ''))}
                        className="w-24 flex-none rounded-lg bg-[var(--surface)] px-3 py-2 text-right text-[13px] text-[var(--ink)] ring-1 ring-transparent focus:outline-none focus:ring-[var(--blue-300)]"
                      />
                      <span className="w-24 flex-none text-right text-[13px] font-bold text-[var(--ink)]">
                        {formatCurrency(itemTotal(item))}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUpdateItem(item.tempId, { expanded: !item.expanded })}
                        className="flex-none rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--ink)]"
                        aria-label="Fornecedor e observação"
                      >
                        <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform duration-200 ${item.expanded ? 'rotate-180' : ''}`} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.tempId)}
                        className="flex-none rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--red-100)] hover:text-[var(--red-500)]"
                        aria-label="Remover item"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {item.expanded && (
                      <div className="mt-2.5 grid gap-2.5 border-t border-[var(--border)] pt-2.5 sm:grid-cols-2">
                        <SearchSelectField
                          label="Fornecedor"
                          placeholder="Buscar por nome ou documento"
                          variant="surface"
                          selectedLabel={item.supplierLabel ?? null}
                          onSearch={searchPeople}
                          getOptionLabel={(person: PersonRecord) => person.name}
                          getOptionSubLabel={(person: PersonRecord) => (person.document ? formatDocument(person.document) : undefined)}
                          onSelect={(person: PersonRecord) => handleUpdateItem(item.tempId, { supplierId: person.id, supplierLabel: person.name })}
                          onClear={() => handleUpdateItem(item.tempId, { supplierId: undefined, supplierLabel: undefined })}
                        />
                        <label className="flex flex-col gap-1.5">
                          <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Observação</span>
                          <input
                            type="text"
                            value={item.note}
                            onChange={(event) => handleUpdateItem(item.tempId, { note: event.target.value })}
                            placeholder="Opcional"
                            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-[13.5px] text-[var(--ink)] focus:outline-none"
                          />
                        </label>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {orderServiceId && !isLocacaoVeiculos(company.system_type) && (
              <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-4">
                {saleId ? (
                  <p className="text-[12.5px] font-semibold text-[var(--green-600)]">
                    Orçamento gerado {saleCode ? `— venda #${saleCode}` : ''}
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleBill}
                    disabled={billing || items.length === 0}
                    className="rounded-xl border border-[var(--border)] px-4 py-2 text-[13px] font-bold text-[var(--ink-soft)] hover:border-[var(--blue-500)] hover:text-[var(--blue-700)] disabled:opacity-50"
                  >
                    {billing ? 'Gerando…' : 'Gerar orçamento'}
                  </button>
                )}
                {billError && <p className="text-[12.5px] font-medium text-[var(--red-500)]">{billError}</p>}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Observações" defaultCollapsed>
            <textarea
              value={noteService}
              onChange={(event) => setNoteService(event.target.value)}
              placeholder="Opcional"
              rows={3}
              className="w-full resize-none rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition placeholder:text-[var(--muted)] focus:outline-none focus:ring-[var(--blue-300)]"
            />
          </SectionCard>

          {Boolean(events?.length) && (
            <SectionCard title="Histórico" defaultCollapsed>
              <div className="flex flex-col gap-3">
                {events!.map((eventItem) => (
                  <div key={eventItem.id} className="flex items-start gap-3">
                    <span className="mt-1.5 h-2 w-2 flex-none rounded-full bg-[var(--blue-500)]" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-[var(--ink)]">{eventItem.title}</p>
                      {eventItem.description && (
                        <p className="mt-0.5 text-[12.5px] text-[var(--ink-soft)]">{eventItem.description}</p>
                      )}
                      <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                        {formatDate(eventItem.eventAt)}
                        {eventItem.user?.name ? ` · ${eventItem.user.name}` : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
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
              {submitting ? 'Salvando…' : 'Salvar OS'}
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
