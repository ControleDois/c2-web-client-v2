import { useEffect, useMemo, useState } from 'react'
import {
  createSale,
  fetchSale,
  SALE_STATUS_LABELS,
  updateSale,
  type SalePayload,
  type SalePlotPayload,
} from '../lib/sales'
import { FORM_PAYMENT_LABELS } from '../lib/bills'
import { fetchPeople, type PersonRecord } from '../lib/people'
import { fetchProducts, type ProductRecord } from '../lib/products'
import { parseMoney } from '../lib/money'
import { formatCurrency, formatDate } from '../lib/format'
import { ApiError } from '../lib/api'
import { SearchSelectField } from '../components/form/SearchSelectField'
import { Select } from '../components/form/Select'
import { MoneyField } from '../components/form/MoneyField'
import { TextField } from '../components/form/TextField'
import { useQuickPerson } from '../hooks/useQuickPerson'
import { useMyCompanyPerson } from '../hooks/useMyCompanyPerson'
import { ChevronLeftIcon, DollarSignIcon, FileTextIcon, PlusIcon, TagIcon, TrashIcon } from '../components/icons'
import type { AuthCompany, AuthSession } from '../lib/auth'

interface SaleFormPageProps {
  session: AuthSession
  company: AuthCompany
  saleId?: string
  onBack: () => void
  onSaved: () => void
}

interface ItemDraft {
  key: string
  productId: string
  description: string
  quantity: string
  unitValue: string
}

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100
const today = () => new Date().toISOString().slice(0, 10)

function addMonths(isoDate: string, months: number): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  const date = new Date(year, month - 1 + months, 1)
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  date.setDate(Math.min(day, lastDay))
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

let keySeed = 0
const nextKey = () => `item${Date.now().toString(36)}${++keySeed}`

const inputClass =
  'w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] placeholder:text-[var(--muted)] ring-1 ring-transparent focus:outline-none focus:ring-[var(--blue-300)]'

// Venda normal lançada pelo painel: cliente, itens, desconto e forma de pagamento (à vista ou parcelada).
// As vendas do PDV, das mesas e do delivery aparecem na listagem sozinhas; aqui é para lançar uma à mão.
export function SaleFormPage({ session, company, saleId, onBack, onSaved }: SaleFormPageProps) {
  const token = session.token.token
  const config = (company.config ?? {}) as Record<string, unknown>
  const quickPerson = useQuickPerson(session, company)
  const myPerson = useMyCompanyPerson(session, company)

  const [loading, setLoading] = useState(Boolean(saleId))
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [locked, setLocked] = useState(false)

  const [person, setPerson] = useState<PersonRecord | null>(null)
  const [dateSale, setDateSale] = useState(today())
  const [status, setStatus] = useState(3)
  const [items, setItems] = useState<ItemDraft[]>([])
  const [discountType, setDiscountType] = useState(1)
  const [discount, setDiscount] = useState('')
  const [note, setNote] = useState('')
  const [formPayment, setFormPayment] = useState(9)
  const [installments, setInstallments] = useState(1)
  const [firstDue, setFirstDue] = useState(today())
  const [paidNow, setPaidNow] = useState(true)

  useEffect(() => {
    if (!saleId) return
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    fetchSale(token, saleId)
      .then((sale) => {
        if (cancelled) return
        setPerson(sale.people ? ({ id: sale.people.id, name: sale.people.name, document: sale.people.document ?? '' } as PersonRecord) : null)
        setDateSale(String(sale.date_sale ?? today()).slice(0, 10))
        setStatus(Number(sale.status))
        setItems(
          (sale.products ?? []).map((item) => ({
            key: nextKey(),
            productId: String(item.product_id ?? ''),
            description: String(item.description ?? item.product?.name ?? ''),
            quantity: String(Number(item.amount ?? 1)),
            unitValue: String(Number(item.cost_value ?? 0)),
          }))
        )
        setDiscountType(sale.discount_type ?? 1)
        setDiscount(Number(sale.discount ?? 0) > 0 ? String(Number(sale.discount)) : '')
        setNote(String(sale.note ?? ''))
        const bills = [...(sale.bills ?? [])].sort((a, b) => Number(a.installment_number ?? 0) - Number(b.installment_number ?? 0))
        if (bills.length) {
          setFormPayment(Number(bills[0].form_payment ?? 9))
          setInstallments(bills.length)
          setFirstDue(String(bills[0].date_due ?? today()).slice(0, 10))
          setPaidNow(bills.length === 1 && Number(bills[0].status) === 1)
        }
        setLocked(bills.some((bill) => Number(bill.status) === 1))
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof ApiError ? err.message : 'Não foi possível carregar a venda.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [saleId, token])

  const subtotal = useMemo(
    () => round2(items.reduce((sum, item) => sum + (parseMoney(item.quantity) ?? 0) * (parseMoney(item.unitValue) ?? 0), 0)),
    [items]
  )
  const discountValue = useMemo(() => {
    const typed = parseMoney(discount) ?? 0
    const value = discountType === 0 ? (subtotal * typed) / 100 : typed
    return round2(Math.min(Math.max(value, 0), subtotal))
  }, [discount, discountType, subtotal])
  const total = round2(subtotal - discountValue)

  const plots: SalePlotPayload[] = useMemo(() => {
    if (status !== 3 || total <= 0) return []
    const count = Math.max(1, installments)
    const base = Math.floor((total / count) * 100) / 100
    const remainder = round2(total - base * count)
    return Array.from({ length: count }, (_, index) => {
      const amount = round2(index === 0 ? base + remainder : base)
      const received = count === 1 && paidNow
      return {
        portion: index + 1,
        form_payment: formPayment,
        date_due: received ? dateSale : addMonths(firstDue, index),
        amount,
        bill_value: amount,
        status: received ? 1 : 0,
      }
    })
  }, [status, total, installments, formPayment, firstDue, dateSale, paidNow])

  function addProduct(product: ProductRecord) {
    setItems((current) => {
      const existing = current.find((item) => item.productId === product.id && !product.ask_name)
      if (existing) {
        return current.map((item) =>
          item.key === existing.key ? { ...item, quantity: String((parseMoney(item.quantity) ?? 0) + 1) } : item
        )
      }
      return [
        ...current,
        {
          key: nextKey(),
          productId: product.id,
          description: product.ask_name ? '' : product.name,
          quantity: '1',
          unitValue: String(Number(product.sale_value ?? 0)),
        },
      ]
    })
  }

  function updateItem(key: string, patch: Partial<ItemDraft>) {
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)))
  }

  async function handleSubmit() {
    setError(null)

    if (locked) {
      setError('Esta venda já tem pagamento recebido e não pode ser editada.')
      return
    }
    const peopleId = person?.id || (config.sale_people_default_id as string | undefined)
    if (!peopleId) {
      setError('Escolha o cliente. Para vender sem cliente, defina um cliente padrão (consumidor) nas configurações de venda.')
      return
    }
    if (!myPerson) {
      setError('Ainda carregando o seu usuário. Aguarde um instante e tente de novo.')
      return
    }
    if (items.length === 0) {
      setError('Adicione pelo menos um item à venda.')
      return
    }
    for (const item of items) {
      if (!item.description.trim()) {
        setError('Dê um nome a todos os itens (o item avulso precisa de nome).')
        return
      }
      if ((parseMoney(item.quantity) ?? 0) <= 0) {
        setError(`Informe a quantidade de "${item.description.trim()}".`)
        return
      }
      if (parseMoney(item.unitValue) === null) {
        setError(`Informe o valor de "${item.description.trim()}".`)
        return
      }
    }
    if (total <= 0) {
      setError('O total da venda precisa ser maior que zero.')
      return
    }

    const payload: SalePayload = {
      companyId: company.id,
      peopleId,
      userId: myPerson.id,
      categoryId: (config.sale_category_default_id as string | undefined) ?? undefined,
      bankAccountId: (config.sale_bank_account_default_id as string | undefined) ?? undefined,
      role: 1,
      status,
      date_sale: dateSale,
      amount: subtotal,
      discount_type: discountType,
      discount: parseMoney(discount) ?? 0,
      net_total: total,
      note: note.trim() || undefined,
      payment_terms: Math.max(plots.length - 1, 0),
      products: items.map((item) => {
        const quantity = parseMoney(item.quantity) ?? 0
        const unitValue = parseMoney(item.unitValue) ?? 0
        const lineTotal = round2(quantity * unitValue)
        return {
          product_id: item.productId,
          description: item.description.trim(),
          amount: quantity,
          cost_value: unitValue,
          discount: 0,
          subtotal: lineTotal,
          total: lineTotal,
        }
      }),
      plots,
    }

    setSubmitting(true)
    try {
      if (saleId) await updateSale(token, saleId, payload)
      else await createSale(token, payload)
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar a venda.')
    } finally {
      setSubmitting(false)
    }
  }

  const isSale = status === 3

  return (
    <div className="flex w-full flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div>
        <button
          type="button"
          onClick={onBack}
          className="mb-3 flex items-center gap-1 text-[12.5px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]"
        >
          <ChevronLeftIcon className="h-3.5 w-3.5" />
          Voltar para vendas
        </button>
        <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Principal</p>
        <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">{saleId ? 'Editar venda' : 'Nova venda'}</h1>
        <p className="mt-1 max-w-[760px] text-[13px] text-[var(--ink-soft)]">
          Escolha o cliente, adicione os itens e diga como foi pago. Para vender no balcão com leitor de código de barras, use o PDV.
        </p>
      </div>

      {loading ? (
        <div className="h-11 animate-pulse rounded-xl bg-[var(--surface)]" />
      ) : loadError ? (
        <p className="rounded-2xl bg-[var(--red-100)] p-5 text-[13.5px] font-medium text-[var(--red-500)]">{loadError}</p>
      ) : (
        <>
          {locked && (
            <p className="rounded-xl bg-[var(--blue-100)] px-4 py-3 text-[12.5px] text-[var(--blue-700)]">
              Esta venda já tem pagamento recebido e não pode ser editada. Para corrigir, cancele a venda na listagem e lance outra.
            </p>
          )}

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="mb-4 text-[14px] font-bold text-[var(--ink)]">Cliente e data</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div className="sm:col-span-2 xl:col-span-1">
                <SearchSelectField
                  label="Cliente"
                  placeholder="Buscar por nome ou documento…"
                  selectedLabel={person?.name ?? null}
                  selectedSubLabel={person?.document || undefined}
                  onSearch={(query) => fetchPeople(token, company.id, { search: query, role: 2, limit: 8 }).then((res) => res.data)}
                  getOptionLabel={(item: PersonRecord) => item.name}
                  getOptionSubLabel={(item: PersonRecord) => item.document || undefined}
                  onSelect={(item: PersonRecord) => setPerson(item)}
                  onCreate={(typed) => quickPerson.request({ role: 2, name: typed, onCreated: (item: PersonRecord) => setPerson(item) })}
                  onClear={() => setPerson(null)}
                />
                {!person && config.sale_people_default_id ? (
                  <p className="mt-1.5 text-[12px] text-[var(--muted)]">Sem escolher ninguém, a venda sai no cliente padrão (consumidor).</p>
                ) : null}
              </div>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Data da venda</span>
                <input type="date" value={dateSale} onChange={(event) => setDateSale(event.target.value)} className={inputClass} />
              </label>
              <div className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Situação</span>
                <Select variant="page" value={status} onChange={(value) => setStatus(Number(value))}>
                  {[3, 0, 1, 2].map((value) => (
                    <option key={value} value={value}>
                      {SALE_STATUS_LABELS[value]}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="mb-1 text-[14px] font-bold text-[var(--ink)]">Itens</h2>
            <p className="mb-4 text-[12.5px] text-[var(--ink-soft)]">Busque o produto ou serviço pelo nome ou código e toque nele para adicionar.</p>
            <SearchSelectField
              label=""
              placeholder="Buscar produto ou serviço…"
              selectedLabel={null}
              onSearch={(query) => fetchProducts(token, company.id, { search: query, limit: 8, ingredient: false }).then((res) => res.data)}
              getOptionLabel={(item: ProductRecord) => item.name}
              getOptionSubLabel={(item: ProductRecord) =>
                [item.role === 1 ? 'Serviço' : item.code ? `Cód. ${item.code}` : '', formatCurrency(Number(item.sale_value ?? 0))].filter(Boolean).join(' · ')
              }
              onSelect={addProduct}
              onClear={() => undefined}
            />

            {items.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed border-[var(--border)] px-4 py-8 text-center text-[13px] text-[var(--muted)]">
                Nenhum item ainda. Busque acima para adicionar o primeiro.
              </p>
            ) : (
              <div className="mt-4 flex flex-col gap-3">
                {items.map((item) => {
                  const lineTotal = round2((parseMoney(item.quantity) ?? 0) * (parseMoney(item.unitValue) ?? 0))
                  return (
                    <div key={item.key} className="rounded-xl bg-[var(--page)] p-3.5">
                      <div className="flex flex-wrap items-end gap-3">
                        <div className="min-w-[200px] flex-1 basis-[240px]">
                          <TextField
                            label="Item"
                            icon={<TagIcon className="h-4 w-4" />}
                            placeholder="Nome do item"
                            value={item.description}
                            onChange={(event) => updateItem(item.key, { description: event.target.value })}
                          />
                        </div>
                        <div className="w-24">
                          <TextField
                            label="Qtd"
                            icon={<FileTextIcon className="h-4 w-4" />}
                            inputMode="decimal"
                            value={item.quantity}
                            onChange={(event) => updateItem(item.key, { quantity: event.target.value.replace(/[^\d.,]/g, '') })}
                          />
                        </div>
                        <div className="w-36">
                          <MoneyField
                            label="Valor"
                            icon={<DollarSignIcon className="h-4 w-4" />}
                            value={item.unitValue}
                            onChange={(event) => updateItem(item.key, { unitValue: event.target.value })}
                          />
                        </div>
                        <div className="w-28 pb-2.5 text-right">
                          <span className="block text-[11px] font-semibold text-[var(--muted)]">Total</span>
                          <span className="text-[15px] font-bold text-[var(--ink)]">{formatCurrency(lineTotal)}</span>
                        </div>
                        <button
                          type="button"
                          aria-label="Tirar este item"
                          onClick={() => setItems((current) => current.filter((entry) => entry.key !== item.key))}
                          className="mb-1 flex h-9 w-9 flex-none items-center justify-center rounded-lg text-[var(--red-500)] hover:bg-[var(--red-100)]"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="mt-5 grid gap-4 border-t border-[var(--border)] pt-5 sm:grid-cols-2">
              <div className="flex flex-wrap items-end gap-3">
                <div className="w-32">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Desconto em</span>
                    <Select variant="page" value={discountType} onChange={(value) => setDiscountType(Number(value))}>
                      <option value="1">R$ (valor)</option>
                      <option value="0">% (percentual)</option>
                    </Select>
                  </div>
                </div>
                <div className="w-36">
                  <TextField
                    label="Desconto"
                    icon={<DollarSignIcon className="h-4 w-4" />}
                    inputMode="decimal"
                    placeholder="0"
                    value={discount}
                    onChange={(event) => setDiscount(event.target.value.replace(/[^\d.,]/g, ''))}
                  />
                </div>
              </div>
              <div className="flex flex-col items-end justify-end gap-1 text-[13px] text-[var(--ink-soft)]">
                <span>Subtotal: {formatCurrency(subtotal)}</span>
                {discountValue > 0 && <span>Desconto: − {formatCurrency(discountValue)}</span>}
                <span className="text-[20px] font-bold text-[var(--ink)]">Total: {formatCurrency(total)}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="mb-1 text-[14px] font-bold text-[var(--ink)]">Pagamento</h2>
            {!isSale ? (
              <p className="text-[12.5px] text-[var(--ink-soft)]">
                O pagamento é definido quando o orçamento virar venda. Mude a situação para "Venda" quando o cliente fechar.
              </p>
            ) : (
              <>
                <p className="mb-4 text-[12.5px] text-[var(--ink-soft)]">Diga como o cliente pagou. Parcelando, o sistema cria uma conta a receber por parcela.</p>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Forma de pagamento</span>
                    <Select variant="page" value={formPayment} onChange={(value) => setFormPayment(Number(value))}>
                      {Object.entries(FORM_PAYMENT_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Parcelas</span>
                    <Select variant="page" value={installments} onChange={(value) => setInstallments(Number(value))}>
                      {Array.from({ length: 12 }, (_, index) => index + 1).map((count) => (
                        <option key={count} value={count}>
                          {count === 1 ? 'À vista' : `${count}x`}
                        </option>
                      ))}
                    </Select>
                  </div>
                  {installments > 1 && (
                    <label className="flex flex-col gap-1.5">
                      <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Vencimento da 1ª parcela</span>
                      <input type="date" value={firstDue} onChange={(event) => setFirstDue(event.target.value)} className={inputClass} />
                    </label>
                  )}
                </div>

                {installments === 1 && (
                  <label className="mt-4 flex items-start gap-2.5 rounded-xl bg-[var(--page)] p-3.5">
                    <input
                      type="checkbox"
                      checked={paidNow}
                      onChange={(event) => setPaidNow(event.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-[var(--blue-500)]"
                    />
                    <span>
                      <span className="block text-[13.5px] font-semibold text-[var(--ink)]">Já foi pago</span>
                      <span className="block text-[12px] text-[var(--ink-soft)]">
                        Marcado: o valor entra como recebido hoje. Desmarcado: fica como conta a receber.
                      </span>
                    </span>
                  </label>
                )}

                {plots.length > 0 && (
                  <div className="mt-4 flex flex-col gap-1.5">
                    {plots.map((plot) => (
                      <div key={plot.portion} className="flex items-center justify-between rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[13px]">
                        <span className="text-[var(--ink)]">
                          {plots.length > 1 ? `Parcela ${plot.portion}/${plots.length}` : 'Pagamento'} · {formatDate(plot.date_due)}
                        </span>
                        <span className="flex items-center gap-2 font-bold text-[var(--ink)]">
                          {formatCurrency(plot.amount)}
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${
                              plot.status === 1 ? 'bg-[var(--green-100)] text-[var(--green-600)]' : 'bg-[var(--amber-100)] text-[var(--amber-500)]'
                            }`}
                          >
                            {plot.status === 1 ? 'Recebido' : 'A receber'}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="mb-3 text-[14px] font-bold text-[var(--ink)]">Observação</h2>
            <textarea
              value={note}
              rows={3}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Opcional"
              className={inputClass}
            />
          </div>

          {error && <p className="rounded-xl bg-[var(--red-100)] px-4 py-3 text-[13.5px] font-medium text-[var(--red-500)]">{error}</p>}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={submitting || locked}
              className="flex items-center gap-2 rounded-xl bg-[var(--blue-500)] px-6 py-2.5 text-[14px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:opacity-60"
            >
              <PlusIcon className="h-4 w-4" />
              {submitting ? 'Salvando…' : isSale ? 'Registrar venda' : 'Salvar orçamento'}
            </button>
            <button
              type="button"
              onClick={onBack}
              className="rounded-xl px-5 py-2.5 text-[14px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]"
            >
              Cancelar
            </button>
          </div>
        </>
      )}
      {quickPerson.modal}
    </div>
  )
}
