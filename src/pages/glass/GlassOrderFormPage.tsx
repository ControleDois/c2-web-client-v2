import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  createGlassOrder,
  fetchGlassModels,
  fetchGlassOrder,
  fetchGlassTypes,
  updateGlassOrder,
  GLASS_ORDER_STATUS,
  type GlassModelRecord,
  type GlassOrderItemRecord,
  type GlassOrderRecord,
  type GlassTypeRecord,
} from '../../lib/glass'
import { fetchPeople, type PersonRecord } from '../../lib/people'
import { formatDocument } from '../../lib/formatDocument'
import { formatCurrency } from '../../lib/format'
import { parseMoney } from '../../lib/money'
import { ApiError } from '../../lib/api'
import { useQuickPerson } from '../../hooks/useQuickPerson'
import { TextField } from '../../components/form/TextField'
import { MoneyField } from '../../components/form/MoneyField'
import { SearchSelectField } from '../../components/form/SearchSelectField'
import { SectionCard } from '../../components/SectionCard'
import { GlassItemModal } from './GlassItemModal'
import { GlassStatusBadge } from './GlassOrdersPage'
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
  const [editing, setEditing] = useState<{ open: boolean; row: ItemRow | null }>({ open: false, row: null })

  useEffect(() => {
    fetchGlassModels(token, company.id, { limit: 200, active: true })
      .then((res) => setModels(res.data || []))
      .catch(() => setModels([]))
    fetchGlassTypes(token, company.id, { limit: 200, active: true })
      .then((res) => setGlassTypes(res.data || []))
      .catch(() => setGlassTypes([]))
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

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (items.length === 0) {
      setError('Adicione ao menos um item ao orçamento.')
      return
    }

    const payload = {
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
      items: items.map(({ key: _key, ...item }) => item),
    }

    setSubmitting(true)
    try {
      if (orderId) await updateGlassOrder(token, orderId, payload)
      else await createGlassOrder(token, payload)
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar o orçamento.')
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
          Voltar para orçamentos
        </button>
        <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Vidraçaria</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-3">
          <h1 className="text-[22px] font-bold tracking-tight text-[var(--ink)]">
            {orderId ? `Orçamento #${order?.code ?? ''}` : 'Novo orçamento'}
          </h1>
          {order && <GlassStatusBadge status={order.status} />}
        </div>
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
                            {[row.location, row.price_overridden ? 'valor alterado manualmente' : null].filter(Boolean).join(' · ')}
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
    </div>
  )
}
