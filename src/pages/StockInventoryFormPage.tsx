import { useEffect, useMemo, useState } from 'react'
import {
  closeStockInventory,
  createStockInventory,
  fetchStockInventory,
  fetchStockSituation,
  formatStockQuantity,
  type StockInventoryRecord,
  type StockSituationRow,
} from '../lib/stock'
import { parseMoney } from '../lib/money'
import { ApiError } from '../lib/api'
import { formatDateTime } from '../lib/format'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ChevronLeftIcon, SearchIcon } from '../components/icons'
import type { AuthCompany, AuthSession } from '../lib/auth'

interface StockInventoryFormPageProps {
  session: AuthSession
  company: AuthCompany
  inventoryId?: string
  onBack: () => void
  onSaved: () => void
}

const TYPE_FILTERS = [
  { value: '', label: 'Tudo' },
  { value: 'ingredient', label: 'Insumos' },
  { value: 'product', label: 'Produtos' },
]

const diffTone = (value: number) =>
  value === 0 ? 'text-[var(--muted)]' : value > 0 ? 'text-[var(--green-600)] font-bold' : 'text-[var(--red-500)] font-bold'

// Contagem de estoque: nova (digita o que contou) ou uma que já existe (ver e, se for rascunho, fechar).
export function StockInventoryFormPage({ session, company, inventoryId, onBack, onSaved }: StockInventoryFormPageProps) {
  const token = session.token.token

  const [rows, setRows] = useState<StockSituationRow[]>([])
  const [counted, setCounted] = useState<Record<string, string>>({})
  const [description, setDescription] = useState(`Contagem de ${new Date().toLocaleDateString('pt-BR')}`)
  const [search, setSearch] = useState('')
  const [type, setType] = useState('')
  const [inventory, setInventory] = useState<StockInventoryRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmClose, setConfirmClose] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    const request = inventoryId
      ? fetchStockInventory(token, inventoryId).then((record) => {
          if (!cancelled) setInventory(record)
        })
      : fetchStockSituation(token, company.id, { limit: 2000 }).then((res) => {
          if (!cancelled) setRows(res.data.filter((row) => !row.has_recipe))
        })
    request
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof ApiError ? err.message : 'Não foi possível carregar os dados.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token, company.id, inventoryId])

  const visibleRows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return rows.filter((row) => {
      if (type === 'ingredient' && !row.is_ingredient) return false
      if (type === 'product' && row.is_ingredient) return false
      return term ? row.name.toLowerCase().includes(term) : true
    })
  }, [rows, search, type])

  const entries = useMemo(
    () =>
      rows
        .map((row) => ({ row, value: counted[row.id] === undefined || counted[row.id] === '' ? null : parseMoney(counted[row.id]) }))
        .filter((entry) => entry.value !== null) as { row: StockSituationRow; value: number }[],
    [rows, counted]
  )
  const withDifference = entries.filter((entry) => entry.value !== entry.row.available_stock).length

  async function save(close: boolean) {
    setError(null)
    if (entries.length === 0) {
      setError('Digite a quantidade contada de pelo menos um item.')
      return
    }
    setSaving(true)
    try {
      await createStockInventory(token, {
        companyId: company.id,
        description: description.trim() || undefined,
        close,
        items: entries.map((entry) => ({ productId: entry.row.id, countedQuantity: entry.value })),
      })
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar a contagem.')
    } finally {
      setSaving(false)
      setConfirmClose(false)
    }
  }

  async function closeExisting() {
    if (!inventory) return
    setSaving(true)
    setError(null)
    try {
      await closeStockInventory(token, inventory.id)
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível fechar a contagem.')
    } finally {
      setSaving(false)
      setConfirmClose(false)
    }
  }

  const isDetail = Boolean(inventoryId)

  return (
    <div className="flex w-full flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div>
        <button
          type="button"
          onClick={onBack}
          className="mb-3 flex items-center gap-1 text-[12.5px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]"
        >
          <ChevronLeftIcon className="h-3.5 w-3.5" />
          Voltar para as contagens
        </button>
        <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Estoque</p>
        <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">{isDetail ? 'Contagem' : 'Nova contagem'}</h1>
        {!isDetail && (
          <p className="mt-1 max-w-[760px] text-[13px] text-[var(--ink-soft)]">
            Digite quanto você contou de cada item (deixe em branco o que não contou). Ao fechar, o estoque passa a ser o que você digitou. "Salvar rascunho" guarda a contagem sem mexer no estoque.
          </p>
        )}
      </div>

      {loading ? (
        <div className="h-11 animate-pulse rounded-xl bg-[var(--surface)]" />
      ) : loadError ? (
        <p className="rounded-2xl bg-[var(--red-100)] p-5 text-[13.5px] font-medium text-[var(--red-500)]">{loadError}</p>
      ) : isDetail && inventory ? (
        <>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[14px] font-bold text-[var(--ink)]">{inventory.description || 'Contagem de estoque'}</p>
                <p className="text-[12px] text-[var(--muted)]">
                  {formatDateTime(inventory.inventory_at)}
                  {inventory.closed_at ? ` · fechada em ${formatDateTime(inventory.closed_at)}` : ''}
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  inventory.status === 1 ? 'bg-[var(--green-100)] text-[var(--green-600)]' : 'bg-[var(--amber-100)] text-[var(--amber-500)]'
                }`}
              >
                {inventory.status === 1 ? 'Fechada' : 'Rascunho'}
              </span>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                    <th className="pb-2.5 pl-3">Item</th>
                    <th className="pb-2.5 text-right">No sistema</th>
                    <th className="pb-2.5 text-right">Contado</th>
                    <th className="pb-2.5 pr-3 text-right">Diferença</th>
                  </tr>
                </thead>
                <tbody>
                  {(inventory.items ?? []).map((item, index) => (
                    <tr key={item.id} className={`border-b border-[var(--border)] last:border-none ${index % 2 === 1 ? 'bg-[var(--page)]' : ''}`}>
                      <td className="py-2.5 pl-3 font-medium text-[var(--ink)]">{item.product?.name ?? '—'}</td>
                      <td className="py-2.5 text-right text-[var(--ink-soft)]">{formatStockQuantity(item.system_quantity)}</td>
                      <td className="py-2.5 text-right font-semibold text-[var(--ink)]">{formatStockQuantity(item.counted_quantity)}</td>
                      <td className={`py-2.5 pr-3 text-right ${diffTone(Number(item.difference_quantity))}`}>
                        {Number(item.difference_quantity) > 0 ? '+' : ''}
                        {formatStockQuantity(Number(item.difference_quantity))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {error && <p className="rounded-xl bg-[var(--red-100)] px-4 py-3 text-[13.5px] font-medium text-[var(--red-500)]">{error}</p>}
          {inventory.status === 0 && (
            <div>
              <button
                type="button"
                onClick={() => setConfirmClose(true)}
                disabled={saving}
                className="rounded-xl bg-[var(--blue-500)] px-6 py-2.5 text-[14px] font-bold text-white hover:bg-[var(--blue-700)] disabled:opacity-60"
              >
                Fechar e ajustar o estoque
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Descrição</span>
                <input
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--blue-300)]"
                />
              </label>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => setCounted(Object.fromEntries(rows.map((row) => [row.id, String(row.available_stock)])))}
                  className="rounded-xl px-4 py-2.5 text-[13px] font-bold text-[var(--blue-700)] ring-1 ring-[var(--blue-300)] hover:bg-[var(--blue-100)]"
                >
                  Começar com o saldo do sistema
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5">
              <SearchIcon className="h-4 w-4 flex-none text-[var(--muted)]" />
              <input
                type="text"
                placeholder="Buscar item"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full bg-transparent text-[13.5px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none"
              />
            </div>
            <div className="flex gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1">
              {TYPE_FILTERS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setType(option.value)}
                  className={`rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition ${
                    type === option.value ? 'bg-[var(--blue-500)] text-white' : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="text-[12.5px] text-[var(--ink-soft)]">
              {entries.length} contados · {withDifference} com diferença
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            {visibleRows.length === 0 ? (
              <p className="py-8 text-center text-[13.5px] text-[var(--muted)]">Nenhum item encontrado.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-left text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                      <th className="pb-2.5 pl-3">Item</th>
                      <th className="pb-2.5 text-right">No sistema</th>
                      <th className="pb-2.5 pl-4">Contado</th>
                      <th className="pb-2.5 pr-3 text-right">Diferença</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row, index) => {
                      const value = counted[row.id] === undefined || counted[row.id] === '' ? null : parseMoney(counted[row.id])
                      const difference = value === null ? null : Math.round((value - row.available_stock) * 10000) / 10000
                      return (
                        <tr key={row.id} className={`border-b border-[var(--border)] last:border-none ${index % 2 === 1 ? 'bg-[var(--page)]' : ''}`}>
                          <td className="py-2 pl-3">
                            <p className="font-medium text-[var(--ink)]">{row.name}</p>
                            <p className="text-[11.5px] text-[var(--muted)]">
                              {row.is_ingredient ? 'Insumo' : 'Produto'}
                              {row.unit ? ` · ${row.unit}` : ''}
                            </p>
                          </td>
                          <td className="py-2 text-right text-[var(--ink-soft)]">{formatStockQuantity(row.available_stock)}</td>
                          <td className="py-2 pl-4">
                            <input
                              inputMode="decimal"
                              value={counted[row.id] ?? ''}
                              placeholder="—"
                              onChange={(event) =>
                                setCounted((current) => ({ ...current, [row.id]: event.target.value.replace(/[^\d.,]/g, '') }))
                              }
                              className="w-28 rounded-xl bg-[var(--page)] px-3 py-2 text-right text-[14px] font-semibold text-[var(--ink)] ring-1 ring-transparent focus:outline-none focus:ring-[var(--blue-300)]"
                            />
                          </td>
                          <td className={`py-2 pr-3 text-right ${difference === null ? 'text-[var(--muted)]' : diffTone(difference)}`}>
                            {difference === null ? '—' : `${difference > 0 ? '+' : ''}${formatStockQuantity(difference)}`}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {error && <p className="rounded-xl bg-[var(--red-100)] px-4 py-3 text-[13.5px] font-medium text-[var(--red-500)]">{error}</p>}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setConfirmClose(true)}
              disabled={saving || entries.length === 0}
              className="rounded-xl bg-[var(--blue-500)] px-6 py-2.5 text-[14px] font-bold text-white hover:bg-[var(--blue-700)] disabled:opacity-60"
            >
              Fechar e ajustar o estoque
            </button>
            <button
              type="button"
              onClick={() => void save(false)}
              disabled={saving || entries.length === 0}
              className="rounded-xl px-5 py-2.5 text-[14px] font-bold text-[var(--blue-700)] ring-1 ring-[var(--blue-300)] hover:bg-[var(--blue-100)] disabled:opacity-60"
            >
              Salvar rascunho
            </button>
            <button type="button" onClick={onBack} className="rounded-xl px-5 py-2.5 text-[14px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]">
              Cancelar
            </button>
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirmClose}
        title="Fechar a contagem?"
        message="O estoque dos itens contados será ajustado para as quantidades digitadas. Os itens em branco não mudam."
        confirmLabel="Fechar e ajustar"
        cancelLabel="Voltar"
        danger={false}
        loading={saving}
        onConfirm={() => void (isDetail ? closeExisting() : save(true))}
        onCancel={() => setConfirmClose(false)}
      />
    </div>
  )
}
