import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  createGlassOrder,
  fetchGlassModels,
  fetchGlassOrder,
  fetchGlassTypes,
  generateGlassOrderBills,
  updateGlassOrder,
  GLASS_ORDER_STATUS,
  GLASS_STAGE_LABELS,
  type GlassModelRecord,
  type GlassOrderItemRecord,
  type GlassOrderRecord,
  type GlassTypeRecord,
} from '../../lib/glass'
import { fetchPeople, type PersonRecord } from '../../lib/people'
import { fetchCategories, type CategoryRecord } from '../../lib/categories'
import { fetchBankAccounts, type BankAccountRecord } from '../../lib/bankAccounts'
import { FORM_PAYMENT_LABELS } from '../../lib/bills'
import { formatDocument } from '../../lib/formatDocument'
import { formatCurrency, formatDate } from '../../lib/format'
import { parseMoney } from '../../lib/money'
import { ApiError } from '../../lib/api'
import { useQuickPerson } from '../../hooks/useQuickPerson'
import { TextField } from '../../components/form/TextField'
import { MoneyField } from '../../components/form/MoneyField'
import { SearchSelectField } from '../../components/form/SearchSelectField'
import { SelectField } from '../../components/form/SelectField'
import { SectionCard } from '../../components/SectionCard'
import { GlassItemModal } from './GlassItemModal'
import { GlassStatusBadge } from './GlassOrdersPage'
import { GlassContractModals, type GlassContractTarget } from './GlassContractModals'
import { ChevronLeftIcon, PlusIcon, PencilIcon, TrashIcon, TagIcon, FileTextIcon, CalendarIcon, CopyIcon } from '../../components/icons'
import type { AuthSession, AuthCompany } from '../../lib/auth'

interface GlassOrderFormPageProps {
  session: AuthSession
  company: AuthCompany
  orderId?: string
  onBack: () => void
  onSaved: () => void
}

interface Client {
  id: string
  label: string
  sub?: string
}

type ItemRow = GlassOrderItemRecord & { key: string }

let itemCounter = 0
const withKey = (item: GlassOrderItemRecord): ItemRow => ({ ...item, key: item.id ?? `new-${++itemCounter}` })
const dateInput = (value?: string | null) => (value ? value.slice(0, 10) : '')

export function GlassOrderFormPage({ session, company, orderId, onBack, onSaved }: GlassOrderFormPageProps) {
  const token = session.token.token
  const quickPerson = useQuickPerson(session, company)
  const [loading, setLoading] = useState(Boolean(orderId))
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [order, setOrder] = useState<GlassOrderRecord | null>(null)
  const [models, setModels] = useState<GlassModelRecord[]>([])
  const [glassTypes, setGlassTypes] = useState<GlassTypeRecord[]>([])
  const [client, setClient] = useState<Client | null>(null)
  const [reference, setReference] = useState('')
  const [workAddress, setWorkAddress] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [expectedDelivery, setExpectedDelivery] = useState('')
  const [notes, setNotes] = useState('')
  const [internalNotes, setInternalNotes] = useState('')
  const [markup, setMarkup] = useState('')
  const [discount, setDiscount] = useState('')
  const [items, setItems] = useState<ItemRow[]>([])
  const [formPayment, setFormPayment] = useState(10)
  const [installments, setInstallments] = useState('1')
  const [firstDueDate, setFirstDueDate] = useState('')
  const [downPayment, setDownPayment] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [bankAccountId, setBankAccountId] = useState('')
  const [categories, setCategories] = useState<CategoryRecord[]>([])
  const [bankAccounts, setBankAccounts] = useState<BankAccountRecord[]>([])
  const [generating, setGenerating] = useState(false)
  const [contractTarget, setContractTarget] = useState<GlassContractTarget | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ open: boolean; row: ItemRow | null }>({ open: false, row: null })

  useEffect(() => {
    fetchGlassModels(token, company.id, { limit: 200, active: true })
      .then((res) => setModels(res.data || []))
      .catch(() => setModels([]))
    fetchGlassTypes(token, company.id, { limit: 200, active: true })
      .then((res) => setGlassTypes(res.data || []))
      .catch(() => setGlassTypes([]))
    fetchCategories(token, company.id, { role: 1, limit: 100 })
      .then((res) => setCategories(res.data))
      .catch(() => setCategories([]))
    fetchBankAccounts(token, company.id, { limit: 100 })
      .then((res) => setBankAccounts(res.data))
      .catch(() => setBankAccounts([]))
  }, [token, company.id])

  useEffect(() => {
    if (!orderId) return
    let cancelled = false
    fetchGlassOrder(token, orderId)
      .then((data) => {
        if (cancelled) return
        setOrder(data)
        setClient(data.people ? { id: data.people.id, label: data.people.name, sub: data.people.document ?? undefined } : null)
        setReference(data.reference ?? '')
        setWorkAddress(data.work_address ?? '')
        setValidUntil(dateInput(data.valid_until))
        setExpectedDelivery(dateInput(data.expected_delivery))
        setNotes(data.notes ?? '')
        setInternalNotes(data.internal_notes ?? '')
        setMarkup(data.markup_percent ? String(data.markup_percent).replace('.', ',') : '')
        setDiscount(data.discount_value ? String(data.discount_value) : '')
        setItems((data.items ?? []).map(withKey))
        setFormPayment(data.form_payment ?? 10)
        setInstallments(String(data.installments ?? 1))
        setFirstDueDate(dateInput(data.first_due_date))
        setDownPayment(data.down_payment ? String(data.down_payment) : '')
        setCategoryId(data.category_id ?? '')
        setBankAccountId(data.bank_account_id ?? '')
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof ApiError ? err.message : 'Não foi possível carregar o orçamento.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [orderId, token])

  const searchPeople = useCallback(
    (query: string) => fetchPeople(token, company.id, { search: query, limit: 8 }).then((res) => res.data),
    [token, company.id]
  )

  const itemsTotal = useMemo(() => items.reduce((sum, item) => sum + (item.total || 0), 0), [items])
  const markupPercent = Number(markup.replace(',', '.')) || 0
  const discountValue = parseMoney(discount) ?? 0
  const total = Math.max(Math.round((itemsTotal * (1 + markupPercent / 100) - discountValue) * 100) / 100, 0)
  const locked = order?.status === GLASS_ORDER_STATUS.CANCELED
  const approved = Boolean(order) && (order?.status ?? 0) >= GLASS_ORDER_STATUS.SALE && !locked
  const bills = order?.bills ?? []

  function saveItem(item: GlassOrderItemRecord) {
    setItems((current) =>
      editing.row
        ? current.map((row) => (row.key === editing.row?.key ? { ...item, key: row.key } : row))
        : [...current, withKey(item)]
    )
    setEditing({ open: false, row: null })
  }

  function duplicateItem(row: ItemRow) {
    setItems((current) => [...current, withKey({ ...row, id: undefined })])
  }

  function buildPayload() {
    return {
      company_id: company.id,
      people_id: client?.id ?? null,
      reference: reference.trim() || null,
      work_address: workAddress.trim() || null,
      valid_until: validUntil || null,
      expected_delivery: expectedDelivery || null,
      markup_percent: markupPercent,
      discount_value: discountValue,
      notes: notes.trim() || null,
      internal_notes: internalNotes.trim() || null,
      form_payment: formPayment,
      installments: Math.max(Number(installments) || 1, 1),
      first_due_date: firstDueDate || null,
      down_payment: parseMoney(downPayment) ?? 0,
      category_id: categoryId || null,
      bank_account_id: bankAccountId || null,
      items: items.map(({ key: _key, ...item }) => item),
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (items.length === 0) {
      setError('Adicione ao menos um item ao orçamento.')
      return
    }

    setSubmitting(true)
    try {
      if (orderId) await updateGlassOrder(token, orderId, buildPayload())
      else await createGlassOrder(token, buildPayload())
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar o orçamento.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleGenerateBills() {
    if (!orderId) return
    setError(null)
    setGenerating(true)
    try {
      await updateGlassOrder(token, orderId, buildPayload())
      const updated = await generateGlassOrderBills(token, orderId)
      setOrder(updated)
      setNotice('Parcelas geradas em Contas a Receber.')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível gerar as parcelas.')
    } finally {
      setGenerating(false)
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
          Voltar para orçamentos
        </button>
        <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Vidraçaria</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-3">
          <h1 className="text-[22px] font-bold tracking-tight text-[var(--ink)]">
            {orderId ? `Orçamento #${order?.code ?? ''}` : 'Novo orçamento'}
          </h1>
          {order && <GlassStatusBadge status={order.status} />}
        </div>
        {order && !locked && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setContractTarget({ mode: 'preview', order })}
              className="rounded-xl border border-[var(--border)] px-3.5 py-2 text-[12.5px] font-bold text-[var(--ink-soft)] hover:text-[var(--ink)]"
            >
              Ver contrato
            </button>
            <button
              type="button"
              onClick={() => setContractTarget({ mode: 'send', order })}
              className="rounded-xl border border-[var(--border)] px-3.5 py-2 text-[12.5px] font-bold text-[var(--ink-soft)] hover:text-[var(--ink)]"
            >
              {order.meta?.contract ? 'Reenviar contrato' : 'Enviar contrato'}
            </button>
            {order.meta?.contract && (
              <>
                <button
                  type="button"
                  onClick={() => setContractTarget({ mode: 'timeline', order })}
                  className="rounded-xl border border-[var(--border)] px-3.5 py-2 text-[12.5px] font-bold text-[var(--ink-soft)] hover:text-[var(--ink)]"
                >
                  Detalhes do envio
                </button>
                <button
                  type="button"
                  onClick={() => setContractTarget({ mode: 'evidence', order })}
                  className="rounded-xl border border-[var(--border)] px-3.5 py-2 text-[12.5px] font-bold text-[var(--ink-soft)] hover:text-[var(--ink)]"
                >
                  Facial e assinatura
                </button>
              </>
            )}
          </div>
        )}
        {locked && order?.cancel_reason && (
          <p className="mt-2 text-[12.5px] text-[var(--red-500)]">Cancelado: {order.cancel_reason}</p>
        )}
      </div>

      {loading ? (
        <div className="h-11 animate-pulse rounded-xl bg-[var(--surface)]" />
      ) : loadError ? (
        <p className="rounded-2xl bg-[var(--red-100)] p-5 text-[13.5px] font-medium text-[var(--red-500)]">{loadError}</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <SectionCard title="Cliente e obra">
            <div className="grid gap-4 sm:grid-cols-2">
              <SearchSelectField
                label="Cliente"
                placeholder="Buscar por nome ou documento"
                selectedLabel={client?.label ?? null}
                selectedSubLabel={client?.sub ? formatDocument(client.sub) : undefined}
                onSearch={searchPeople}
                getOptionLabel={(item: PersonRecord) => item.name}
                getOptionSubLabel={(item: PersonRecord) => (item.document ? formatDocument(item.document) : undefined)}
                onSelect={(item: PersonRecord) => setClient({ id: item.id, label: item.name, sub: item.document ?? undefined })}
                onCreate={(typed) =>
                  quickPerson.request({
                    role: 2,
                    name: typed,
                    onCreated: (item: PersonRecord) => setClient({ id: item.id, label: item.name, sub: item.document ?? undefined }),
                  })
                }
                onClear={() => setClient(null)}
              />
              <TextField
                label="Referência da obra"
                icon={<TagIcon className="h-4 w-4" />}
                placeholder="Ex: Reforma apto 302"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
              />
              <TextField
                label="Endereço da obra"
                icon={<FileTextIcon className="h-4 w-4" />}
                value={workAddress}
                onChange={(event) => setWorkAddress(event.target.value)}
              />
              <div className="grid grid-cols-2 gap-4">
                <TextField
                  label="Validade"
                  icon={<CalendarIcon className="h-4 w-4" />}
                  type="date"
                  value={validUntil}
                  onChange={(event) => setValidUntil(event.target.value)}
                />
                <TextField
                  label="Previsão de entrega"
                  icon={<CalendarIcon className="h-4 w-4" />}
                  type="date"
                  value={expectedDelivery}
                  onChange={(event) => setExpectedDelivery(event.target.value)}
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Itens"
            subtitle="Cada item é uma peça com medidas; o preço sai do modelo e do vidro escolhidos"
            headerExtra={
              !locked && (
                <button
                  type="button"
                  onClick={() => setEditing({ open: true, row: null })}
                  className="flex items-center gap-1.5 rounded-xl bg-[var(--blue-500)] px-3.5 py-2 text-[12.5px] font-bold text-white hover:bg-[var(--blue-700)]"
                >
                  <PlusIcon className="h-3.5 w-3.5" />
                  Adicionar item
                </button>
              )
            }
          >
            {items.length === 0 ? (
              <p className="py-6 text-center text-[13.5px] text-[var(--muted)]">Nenhum item ainda. Adicione a primeira peça.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-left text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                      <th className="pb-2.5">Item</th>
                      <th className="pb-2.5">Medidas (mm)</th>
                      <th className="pb-2.5 text-right">Qtd</th>
                      <th className="pb-2.5 text-right">Unitário</th>
                      <th className="pb-2.5 text-right">Total</th>
                      <th className="w-24 pb-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((row) => (
                      <tr key={row.key} className="border-b border-[var(--border)] last:border-none">
                        <td className="py-2.5 pr-3">
                          <p className="font-medium text-[var(--ink)]">{row.description}</p>
                          <p className="text-[11.5px] text-[var(--muted)]">
                            {[
                              row.location,
                              row.price_overridden ? 'valor alterado manualmente' : null,
                              approved ? GLASS_STAGE_LABELS[row.production_stage ?? 0] : null,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        </td>
                        <td className="py-2.5 whitespace-nowrap text-[var(--ink-soft)]">
                          {row.width_mm} × {row.height_mm}
                        </td>
                        <td className="py-2.5 text-right">{row.quantity}</td>
                        <td className="py-2.5 text-right">{formatCurrency(row.unit_price)}</td>
                        <td className="py-2.5 text-right font-semibold">{formatCurrency(row.total)}</td>
                        <td className="py-2.5 text-right">
                          {!locked && (
                            <div className="flex justify-end gap-1">
                              <button type="button" onClick={() => setEditing({ open: true, row })} aria-label="Editar item" className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--page)] hover:text-[var(--ink)]">
                                <PencilIcon className="h-3.5 w-3.5" />
                              </button>
                              <button type="button" onClick={() => duplicateItem(row)} aria-label="Duplicar item" className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--page)] hover:text-[var(--ink)]">
                                <CopyIcon className="h-3.5 w-3.5" />
                              </button>
                              <button type="button" onClick={() => setItems((current) => current.filter((item) => item.key !== row.key))} aria-label="Remover item" className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--red-100)] hover:text-[var(--red-500)]">
                                <TrashIcon className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Negociação e totais">
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField
                label="Acréscimo / margem (%)"
                icon={<TagIcon className="h-4 w-4" />}
                inputMode="decimal"
                placeholder="0"
                value={markup}
                disabled={locked}
                onChange={(event) => setMarkup(event.target.value.replace(/[^\d,.]/g, ''))}
              />
              <MoneyField
                label="Desconto (R$)"
                icon={<TagIcon className="h-4 w-4" />}
                value={discount}
                disabled={locked}
                onChange={(event) => setDiscount(event.target.value)}
              />
              <div className="flex flex-col justify-end rounded-xl bg-[var(--page)] px-4 py-3">
                <span className="text-[12px] text-[var(--ink-soft)]">Itens: {formatCurrency(itemsTotal)}</span>
                <span className="text-[18px] font-bold text-[var(--ink)]">{formatCurrency(total)}</span>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Pagamento"
            subtitle="Condições usadas ao gerar as contas a receber depois que a venda for aprovada"
          >
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <SelectField
                label="Forma de pagamento"
                value={formPayment}
                onChange={(event) => setFormPayment(Number(event.target.value))}
              >
                {Object.entries(FORM_PAYMENT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </SelectField>
              <MoneyField
                label="Entrada / sinal (R$)"
                icon={<TagIcon className="h-4 w-4" />}
                value={downPayment}
                disabled={locked}
                onChange={(event) => setDownPayment(event.target.value)}
              />
              <TextField
                label="Parcelas do restante"
                icon={<TagIcon className="h-4 w-4" />}
                inputMode="numeric"
                value={installments}
                disabled={locked}
                onChange={(event) => setInstallments(event.target.value.replace(/\D/g, ''))}
              />
              <TextField
                label="1º vencimento"
                icon={<CalendarIcon className="h-4 w-4" />}
                type="date"
                value={firstDueDate}
                disabled={locked}
                onChange={(event) => setFirstDueDate(event.target.value)}
              />
              <SelectField label="Categoria" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                <option value="">Selecione</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
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
            </div>

            {bills.length > 0 && (
              <div className="mt-4 overflow-x-auto rounded-xl bg-[var(--page)] p-3">
                <table className="w-full border-collapse text-[13px]">
                  <tbody>
                    {bills.map((bill) => (
                      <tr key={bill.id} className="border-b border-[var(--border)] last:border-none">
                        <td className="py-1.5 text-[var(--ink)]">{bill.name}</td>
                        <td className="py-1.5 text-[var(--ink-soft)]">{formatDate(bill.date_due)}</td>
                        <td className="py-1.5 text-right font-semibold">{formatCurrency(bill.amount)}</td>
                        <td className="py-1.5 pl-3 text-right text-[12px] text-[var(--muted)]">{bill.status === 0 ? 'Aberta' : 'Paga'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {approved && (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={generating}
                  onClick={handleGenerateBills}
                  className="rounded-xl bg-[var(--page)] px-4 py-2.5 text-[13px] font-bold text-[var(--blue-700)] hover:bg-[var(--blue-100)] disabled:opacity-60"
                >
                  {generating ? 'Gerando…' : bills.length ? 'Salvar e regerar parcelas' : 'Salvar e gerar parcelas'}
                </button>
                <span className="text-[12px] text-[var(--muted)]">
                  A entrada vence hoje; o restante é dividido a partir do 1º vencimento.
                </span>
              </div>
            )}
            {!approved && orderId && !locked && (
              <p className="mt-4 text-[12px] text-[var(--muted)]">
                As parcelas podem ser geradas depois de aprovar a venda (ação “Aprovar venda” na lista ou assinatura do contrato).
              </p>
            )}
          </SectionCard>

          <SectionCard title="Observações" defaultCollapsed={!notes && !internalNotes}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Observações para o cliente</span>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={4}
                  className="rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] focus:outline-none"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Anotações internas</span>
                <textarea
                  value={internalNotes}
                  onChange={(event) => setInternalNotes(event.target.value)}
                  rows={4}
                  className="rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] focus:outline-none"
                />
              </label>
            </div>
          </SectionCard>

          {error && (
            <p className="rounded-xl bg-[var(--red-100)] px-4 py-3 text-[13.5px] font-medium text-[var(--red-500)]">{error}</p>
          )}

          <div className="flex items-center gap-3">
            {!locked && (
              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl bg-[var(--blue-500)] px-6 py-2.5 text-[14px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:opacity-60"
              >
                {submitting ? 'Salvando…' : 'Salvar orçamento'}
              </button>
            )}
            <button
              type="button"
              onClick={onBack}
              className="rounded-xl px-5 py-2.5 text-[14px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]"
            >
              {locked ? 'Voltar' : 'Cancelar'}
            </button>
          </div>
        </form>
      )}

      <GlassItemModal
        open={editing.open}
        token={token}
        companyId={company.id}
        item={editing.row}
        models={models}
        glassTypes={glassTypes}
        onSave={saveItem}
        onClose={() => setEditing({ open: false, row: null })}
      />
      {quickPerson.modal}
      <GlassContractModals
        session={session}
        company={company}
        target={contractTarget}
        onClose={() => setContractTarget(null)}
        onSent={setNotice}
      />
      {notice && (
        <div
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-[var(--ink)] px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg"
          onClick={() => setNotice(null)}
        >
          {notice}
        </div>
      )}
    </div>
  )
}
