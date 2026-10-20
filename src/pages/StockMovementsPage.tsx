import { useEffect, useState } from 'react'
import {
  fetchStockMovements,
  formatStockQuantity,
  MOVEMENT_TYPE_LABELS,
  ORIGIN_LABELS,
  REASON_LABELS,
  type StockMovementRecord,
  type StockReason,
} from '../lib/stock'
import { ApiError } from '../lib/api'
import { formatCurrency, formatDateTime } from '../lib/format'
import { Select } from '../components/form/Select'
import { ChevronLeftIcon, CloseIcon, SearchIcon } from '../components/icons'
import type { AuthCompany, AuthSession } from '../lib/auth'

interface StockMovementsPageProps {
  session: AuthSession
  company: AuthCompany
  // Quando vem de "Ver movimentações" de um item, a lista já abre só com ele.
  product?: { id: string; name: string } | null
  onClearProduct: () => void
  onBack: () => void
}

const TYPE_OPTIONS = [
  { value: '', label: 'Todos os tipos' },
  { value: 'entry', label: 'Entradas' },
  { value: 'exit', label: 'Saídas' },
  { value: 'inventory', label: 'Inventário' },
  { value: 'manual', label: 'Ajustes' },
]

function originText(movement: StockMovementRecord): string {
  if (movement.reason && REASON_LABELS[movement.reason as StockReason]) return REASON_LABELS[movement.reason as StockReason]
  return ORIGIN_LABELS[movement.origin_type] ?? movement.origin_type
}

export function StockMovementsPage({ session, company, product, onClearProduct, onBack }: StockMovementsPageProps) {
  const token = session.token.token
  const [search, setSearch] = useState('')
  const [movementType, setMovementType] = useState('')
  const [dateStart, setDateStart] = useState('')
  const [dateEnd, setDateEnd] = useState('')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<StockMovementRecord[]>([])
  const [meta, setMeta] = useState({ total: 0, lastPage: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    const timeout = setTimeout(() => {
      fetchStockMovements(token, company.id, {
        search: search.trim() || undefined,
        movementType,
        productId: product?.id,
        dateStart,
        dateEnd,
        page,
        limit: 20,
      })
        .then((res) => {
          if (cancelled) return
          setRows(res.data)
          setMeta({ total: res.meta?.total ?? res.data.length, lastPage: res.meta?.last_page ?? 1 })
        })
        .catch((err) => {
          if (!cancelled) setError(err instanceof ApiError ? err.message : 'Não foi possível carregar as movimentações.')
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [token, company.id, search, movementType, product?.id, dateStart, dateEnd, page])

  return (
    <div className="flex w-full flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div>
        <button
          type="button"
          onClick={onBack}
          className="mb-3 flex items-center gap-1 text-[12.5px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]"
        >
          <ChevronLeftIcon className="h-3.5 w-3.5" />
          Voltar para a situação do estoque
        </button>
        <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Estoque</p>
        <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">Movimentações</h1>
        <p className="mt-1 max-w-[760px] text-[13px] text-[var(--ink-soft)]">
          Tudo que entrou e saiu do estoque: vendas, entradas de mercadoria, perdas e contagens. Em verde o que entrou, em vermelho o que saiu.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5">
          <SearchIcon className="h-4 w-4 flex-none text-[var(--muted)]" />
          <input
            type="text"
            placeholder="Buscar por item ou observação"
            value={search}
            onChange={(event) => {
              setPage(1)
              setSearch(event.target.value)
            }}
            className="w-full bg-transparent text-[13.5px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none"
          />
        </div>
        <div className="w-full sm:w-52">
          <Select
            value={movementType}
            onChange={(value) => {
              setPage(1)
              setMovementType(value)
            }}
          >
            {TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
        <label className="flex items-center gap-2 text-[12px] font-semibold text-[var(--ink-soft)]">
          De
          <input
            type="date"
            value={dateStart}
            onChange={(event) => {
              setPage(1)
              setDateStart(event.target.value)
            }}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[13px] text-[var(--ink)] focus:outline-none"
          />
        </label>
        <label className="flex items-center gap-2 text-[12px] font-semibold text-[var(--ink-soft)]">
          até
          <input
            type="date"
            value={dateEnd}
            onChange={(event) => {
              setPage(1)
              setDateEnd(event.target.value)
            }}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[13px] text-[var(--ink)] focus:outline-none"
          />
        </label>
      </div>

      {product && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-[var(--blue-100)] px-4 py-3">
          <p className="text-[13px] text-[var(--blue-700)]">
            Mostrando só as movimentações de <strong>{product.name}</strong>.
          </p>
          <button
            type="button"
            onClick={() => {
              setPage(1)
              onClearProduct()
            }}
            className="flex items-center gap-1 text-[12.5px] font-bold text-[var(--blue-700)] hover:underline"
          >
            <CloseIcon className="h-3.5 w-3.5" />
            Ver todos os itens
          </button>
        </div>
      )}

      {error && <div className="rounded-2xl bg-[var(--red-100)] p-4 text-[13.5px] font-medium text-[var(--red-500)]">{error}</div>}

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        {loading ? (
          <div className="flex flex-col gap-2.5">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-11 animate-pulse rounded-xl bg-[var(--page)]" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-[13.5px] text-[var(--muted)]">Nenhuma movimentação encontrada.</p>
        ) : (
          <>
            <div className="flex flex-col gap-2.5 sm:hidden">
              {rows.map((row) => (
                <div key={row.id} className="rounded-xl border border-[var(--border)] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 truncate text-[13.5px] font-bold text-[var(--ink)]">{row.product?.name ?? '—'}</p>
                    <span className={`flex-none text-[14px] font-bold ${row.quantity < 0 ? 'text-[var(--red-500)]' : 'text-[var(--green-600)]'}`}>
                      {row.quantity > 0 ? '+' : ''}
                      {formatStockQuantity(row.quantity)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[12px] text-[var(--muted)]">
                    {MOVEMENT_TYPE_LABELS[row.movement_type] ?? row.movement_type} · {originText(row)} · {formatDateTime(row.movement_at)}
                  </p>
                </div>
              ))}
            </div>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                    <th className="pb-2.5 pl-3">Data</th>
                    <th className="pb-2.5">Item</th>
                    <th className="pb-2.5">Tipo</th>
                    <th className="pb-2.5 text-right">Quantidade</th>
                    <th className="pb-2.5 text-right">Saldo depois</th>
                    <th className="pb-2.5 text-right">Custo</th>
                    <th className="pb-2.5 pl-4">Origem</th>
                    <th className="pb-2.5 pr-3">Observação</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={row.id} className={`border-b border-[var(--border)] last:border-none ${index % 2 === 1 ? 'bg-[var(--page)]' : ''}`}>
                      <td className="py-2.5 pl-3 whitespace-nowrap text-[var(--ink-soft)]">{formatDateTime(row.movement_at)}</td>
                      <td className="py-2.5 font-medium text-[var(--ink)]">{row.product?.name ?? '—'}</td>
                      <td className="py-2.5 text-[var(--ink-soft)]">{MOVEMENT_TYPE_LABELS[row.movement_type] ?? row.movement_type}</td>
                      <td
                        className={`py-2.5 text-right font-bold whitespace-nowrap ${
                          row.quantity < 0 ? 'text-[var(--red-500)]' : 'text-[var(--green-600)]'
                        }`}
                      >
                        {row.quantity > 0 ? '+' : ''}
                        {formatStockQuantity(row.quantity)}
                        {row.product?.unit ? <span className="ml-1 text-[11px] font-normal text-[var(--muted)]">{row.product.unit}</span> : null}
                      </td>
                      <td className="py-2.5 text-right whitespace-nowrap text-[var(--ink-soft)]">{formatStockQuantity(row.balance_after)}</td>
                      <td className="py-2.5 text-right whitespace-nowrap text-[var(--ink-soft)]">
                        {row.unit_cost > 0 ? formatCurrency(row.unit_cost) : '—'}
                      </td>
                      <td className="py-2.5 pl-4 text-[var(--ink-soft)]">{originText(row)}</td>
                      <td className="max-w-[260px] truncate py-2.5 pr-3 text-[var(--muted)]" title={row.description ?? ''}>
                        {row.description || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {!loading && meta.lastPage > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-[12px] text-[var(--muted)]">{meta.total} movimentações</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--ink-soft)] disabled:opacity-40"
              >
                Anterior
              </button>
              <span className="text-[12.5px] text-[var(--ink-soft)]">
                {page} / {meta.lastPage}
              </span>
              <button
                type="button"
                disabled={page >= meta.lastPage}
                onClick={() => setPage((current) => Math.min(meta.lastPage, current + 1))}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--ink-soft)] disabled:opacity-40"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
