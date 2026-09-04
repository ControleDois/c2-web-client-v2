import { Fragment, useEffect, useMemo, useState } from 'react'
import {
  fetchPurchaseStockItems,
  addPurchaseStockItem,
  updatePurchaseStockItem,
  removePurchaseStockItem,
  createPurchaseRequest,
  type PurchaseStockItemRecord,
} from '../lib/purchaseManagement'
import { fetchProducts, type ProductRecord } from '../lib/products'
import { formatCurrency } from '../lib/format'
import { ApiError } from '../lib/api'
import { SearchIcon, PlusIcon, TrashIcon, CheckCircleIcon, AlertTriangleIcon, ClockIcon } from '../components/icons'
import type { AuthSession, AuthCompany } from '../lib/auth'

interface PurchaseManagementPageProps {
  session: AuthSession
  company: AuthCompany
  onBack: () => void
  onViewHistory: () => void
}

function isLowStock(item: PurchaseStockItemRecord): boolean {
  return item.min_stock !== null && item.min_stock !== undefined && item.current_stock < item.min_stock
}

export function PurchaseManagementPage({ session, company, onBack, onViewHistory }: PurchaseManagementPageProps) {
  const [items, setItems] = useState<PurchaseStockItemRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [orderQty, setOrderQty] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)

  const [showAddPanel, setShowAddPanel] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [productResults, setProductResults] = useState<ProductRecord[]>([])
  const [searchingProducts, setSearchingProducts] = useState(false)
  const [addingProductId, setAddingProductId] = useState<string | null>(null)

  useEffect(() => {
    if (!feedback) return
    const timeout = setTimeout(() => setFeedback(null), 3200)
    return () => clearTimeout(timeout)
  }, [feedback])

  function load() {
    setLoading(true)
    setError(null)
    fetchPurchaseStockItems(session.token.token, company.id, { limit: 500 })
      .then((res) => setItems(res.data))
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : 'Não foi possível carregar a lista de compras.')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.token.token, company.id])

  useEffect(() => {
    if (!showAddPanel) return
    const term = productSearch.trim()
    let cancelled = false
    setSearchingProducts(true)
    const timeout = setTimeout(() => {
      fetchProducts(session.token.token, company.id, { search: term || undefined, role: 0, limit: 20 })
        .then((res) => {
          if (cancelled) return
          const existingIds = new Set(items.map((item) => item.product_id))
          setProductResults(res.data.filter((product) => !existingIds.has(product.id)))
        })
        .catch(() => {
          if (!cancelled) setProductResults([])
        })
        .finally(() => {
          if (!cancelled) setSearchingProducts(false)
        })
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [showAddPanel, productSearch, session.token.token, company.id, items])

  async function handleAddProduct(product: ProductRecord) {
    setAddingProductId(product.id)
    try {
      const created = await addPurchaseStockItem(session.token.token, {
        company_id: company.id,
        product_id: product.id,
        current_stock: 0,
        avg_price: 0,
      })
      setItems((prev) => [{ ...created, product: created.product ?? product }, ...prev])
      setProductSearch('')
    } catch (err) {
      setFeedback({
        tone: 'error',
        message: err instanceof ApiError ? err.message : 'Não foi possível adicionar o produto.',
      })
    } finally {
      setAddingProductId(null)
    }
  }

  function handleFieldChange(id: string, field: 'avg_price' | 'current_stock' | 'min_stock', value: string) {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, [field]: value === '' ? (field === 'min_stock' ? null : 0) : Number(value) }
          : item
      )
    )
  }

  async function handleFieldBlur(item: PurchaseStockItemRecord, field: 'avg_price' | 'current_stock' | 'min_stock') {
    try {
      await updatePurchaseStockItem(session.token.token, item.id, {
        avg_price: field === 'avg_price' ? item.avg_price : undefined,
        current_stock: field === 'current_stock' ? item.current_stock : undefined,
        min_stock: field === 'min_stock' ? item.min_stock : undefined,
      })
    } catch (err) {
      setFeedback({
        tone: 'error',
        message: err instanceof ApiError ? err.message : 'Não foi possível salvar a alteração.',
      })
    }
  }

  async function handleRemove(item: PurchaseStockItemRecord) {
    try {
      await removePurchaseStockItem(session.token.token, item.id)
      setItems((prev) => prev.filter((i) => i.id !== item.id))
    } catch (err) {
      setFeedback({
        tone: 'error',
        message: err instanceof ApiError ? err.message : 'Não foi possível remover o produto da lista.',
      })
    }
  }

  function qtyFor(itemId: string): number {
    const raw = orderQty[itemId]
    if (!raw) return 0
    const value = Number(raw.replace(',', '.'))
    return Number.isNaN(value) ? 0 : value
  }

  const rows = useMemo(
    () =>
      items.map((item) => ({
        item,
        qty: qtyFor(item.id),
        forecast: qtyFor(item.id) * (item.avg_price || 0),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, orderQty]
  )

  const total = rows.reduce((sum, row) => sum + row.forecast, 0)
  const hasOrder = rows.some((row) => row.qty > 0)

  const groupedRows = useMemo(() => {
    const groups = new Map<string, typeof rows>()
    for (const row of rows) {
      const categoryName = row.item.product?.categories?.[0]?.name || 'Sem categoria'
      if (!groups.has(categoryName)) groups.set(categoryName, [])
      groups.get(categoryName)!.push(row)
    }
    const entries = Array.from(groups.entries())
    entries.sort(([a], [b]) => {
      if (a === 'Sem categoria') return 1
      if (b === 'Sem categoria') return -1
      return a.localeCompare(b, 'pt-BR')
    })
    return entries.map(([name, groupRows]) => ({ name, rows: groupRows }))
  }, [rows])

  async function handleSubmitRequest() {
    const requestItems = rows
      .filter((row) => row.qty > 0)
      .map((row) => ({ product_id: row.item.product_id, quantity: row.qty, unit_price: row.item.avg_price || 0 }))

    if (requestItems.length === 0) return

    setSubmitting(true)
    try {
      await createPurchaseRequest(session.token.token, { company_id: company.id, items: requestItems })
      setOrderQty({})
      setFeedback({ tone: 'success', message: 'Solicitação de compra enviada com sucesso.' })
    } catch (err) {
      setFeedback({
        tone: 'error',
        message: err instanceof ApiError ? err.message : 'Não foi possível enviar a solicitação de compra.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Operação</p>
          <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">Gestão de Compras</h1>
          <p className="mt-1 text-[13px] text-[var(--muted)]">
            Acompanhe o estoque de insumos, edite preços e envie solicitações de compra.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onViewHistory}
            className="flex items-center gap-2 rounded-xl bg-[var(--page)] px-4 py-2.5 text-[13px] font-bold text-[var(--ink-soft)] transition hover:text-[var(--ink)]"
          >
            <ClockIcon className="h-4 w-4" />
            Ver histórico
          </button>
          <button
            type="button"
            onClick={onBack}
            className="rounded-xl px-4 py-2.5 text-[13px] font-semibold text-[var(--muted)] hover:text-[var(--ink)]"
          >
            Voltar
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl bg-[var(--red-100)] p-4 text-[13.5px] font-medium text-[var(--red-500)]">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        {!showAddPanel ? (
          <button
            type="button"
            onClick={() => setShowAddPanel(true)}
            className="flex items-center gap-2 rounded-xl border border-dashed border-[var(--border)] px-4 py-2.5 text-[12.5px] font-semibold text-[var(--ink-soft)] hover:border-[var(--blue-500)] hover:text-[var(--blue-700)]"
          >
            <PlusIcon className="h-4 w-4" />
            Adicionar produto
          </button>
        ) : (
          <div>
            <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--page)] px-3.5 py-2.5">
              <SearchIcon className="h-4 w-4 flex-none text-[var(--muted)]" />
              <input
                type="text"
                autoFocus
                placeholder="Buscar produto por nome"
                value={productSearch}
                onChange={(event) => setProductSearch(event.target.value)}
                className="w-full bg-transparent text-[13.5px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  setShowAddPanel(false)
                  setProductSearch('')
                }}
                className="text-[12px] font-semibold text-[var(--muted)] hover:text-[var(--ink)]"
              >
                Fechar
              </button>
            </div>

            <div className="mt-2 flex flex-col gap-1">
              {searchingProducts ? (
                <p className="px-2 py-2 text-[12.5px] text-[var(--muted)]">Buscando…</p>
              ) : productResults.length === 0 ? (
                <p className="px-2 py-2 text-[12.5px] text-[var(--muted)]">Nenhum produto encontrado.</p>
              ) : (
                productResults.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    disabled={addingProductId === product.id}
                    onClick={() => handleAddProduct(product)}
                    className="flex items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] text-[var(--ink)] hover:bg-[var(--page)] disabled:opacity-50"
                  >
                    <span>{product.name}</span>
                    <span className="text-[11.5px] font-semibold text-[var(--blue-700)]">
                      {addingProductId === product.id ? 'Adicionando…' : '+ Adicionar'}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        {loading ? (
          <div className="flex flex-col gap-2.5">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-11 animate-pulse rounded-xl bg-[var(--page)]" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-[13.5px] text-[var(--muted)]">
            Nenhum produto na lista de compras ainda. Use "Adicionar produto" para começar.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] table-fixed border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                  <th className="w-[26%] px-2 pb-2.5">Produto</th>
                  <th className="w-[13%] px-2 pb-2.5">Estoque atual</th>
                  <th className="w-[13%] px-2 pb-2.5">Estoque mínimo</th>
                  <th className="w-[15%] px-2 pb-2.5">Preço médio</th>
                  <th className="w-[13%] px-2 pb-2.5">Pedido de compra</th>
                  <th className="w-[14%] px-2 pb-2.5 text-right">$ Previsto</th>
                  <th className="w-8 pb-2.5" />
                </tr>
              </thead>
              <tbody>
                {groupedRows.map((group) => (
                  <Fragment key={group.name}>
                    <tr className="bg-[var(--page)]">
                      <td colSpan={7} className="px-2 py-2 text-[11px] font-bold uppercase tracking-wide text-[var(--ink-soft)]">
                        {group.name}
                        <span className="ml-1.5 font-normal normal-case text-[var(--muted)]">
                          ({group.rows.length})
                        </span>
                      </td>
                    </tr>
                    {group.rows.map(({ item, forecast }) => {
                      const low = isLowStock(item)
                      return (
                        <tr
                          key={item.id}
                          className={`border-b border-[var(--border)] align-middle last:border-none ${
                            low ? 'bg-[var(--red-100)]' : ''
                          }`}
                        >
                          <td className="px-2 py-2.5">
                            <div className="flex items-center gap-1.5">
                              {low && <AlertTriangleIcon className="h-3.5 w-3.5 flex-none text-[var(--red-500)]" />}
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-[var(--ink)]">{item.product?.name ?? '—'}</p>
                                {item.product?.unit && (
                                  <p className="text-[11px] text-[var(--muted)]">{item.product.unit}</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-2 py-2.5">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={item.current_stock}
                              onChange={(event) => handleFieldChange(item.id, 'current_stock', event.target.value)}
                              onBlur={() => handleFieldBlur(item, 'current_stock')}
                              className="w-full rounded-lg bg-[var(--page)] px-2.5 py-1.5 text-[13px] text-[var(--ink)] ring-1 ring-transparent focus:outline-none focus:ring-[var(--blue-300)]"
                            />
                          </td>
                          <td className="px-2 py-2.5">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={item.min_stock ?? ''}
                              onChange={(event) => handleFieldChange(item.id, 'min_stock', event.target.value)}
                              onBlur={() => handleFieldBlur(item, 'min_stock')}
                              placeholder="—"
                              className="w-full rounded-lg bg-[var(--page)] px-2.5 py-1.5 text-[13px] text-[var(--ink)] ring-1 ring-transparent placeholder:text-[var(--muted)] focus:outline-none focus:ring-[var(--blue-300)]"
                            />
                          </td>
                          <td className="px-2 py-2.5">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={item.avg_price}
                              onChange={(event) => handleFieldChange(item.id, 'avg_price', event.target.value)}
                              onBlur={() => handleFieldBlur(item, 'avg_price')}
                              className="w-full rounded-lg bg-[var(--page)] px-2.5 py-1.5 text-[13px] text-[var(--ink)] ring-1 ring-transparent focus:outline-none focus:ring-[var(--blue-300)]"
                            />
                          </td>
                          <td className="px-2 py-2.5">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={orderQty[item.id] ?? ''}
                              onChange={(event) => setOrderQty((prev) => ({ ...prev, [item.id]: event.target.value }))}
                              placeholder="0"
                              className="w-full rounded-lg bg-[var(--blue-100)] px-2.5 py-1.5 text-[13px] font-semibold text-[var(--blue-700)] ring-1 ring-transparent placeholder:text-[var(--muted)] focus:outline-none focus:ring-[var(--blue-300)]"
                            />
                          </td>
                          <td className="px-2 py-2.5 text-right font-bold text-[var(--ink)]">
                            {forecast > 0 ? formatCurrency(forecast) : '—'}
                          </td>
                          <td className="px-2 py-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemove(item)}
                              className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--page)] hover:text-[var(--red-500)]"
                            >
                              <TrashIcon className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5} className="px-2 pt-3 text-right text-[12.5px] font-semibold text-[var(--ink-soft)]">
                    Total previsto
                  </td>
                  <td className="px-2 pt-3 text-right text-[15px] font-bold text-[var(--green-600)]">
                    {formatCurrency(total)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {rows.length > 0 && (
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={handleSubmitRequest}
              disabled={!hasOrder || submitting}
              className="flex items-center gap-2 rounded-xl bg-[var(--blue-500)] px-5 py-2.5 text-[13.5px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:opacity-60"
            >
              <CheckCircleIcon className="h-4 w-4" />
              {submitting ? 'Enviando…' : 'Enviar solicitação de compra'}
            </button>
          </div>
        )}
      </div>

      {feedback && (
        <div
          className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg ${
            feedback.tone === 'success' ? 'bg-[var(--green-600)]' : 'bg-[var(--red-500)]'
          }`}
        >
          {feedback.message}
        </div>
      )}
    </div>
  )
}
