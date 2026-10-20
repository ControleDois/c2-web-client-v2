import { useCallback, useEffect, useState } from 'react'
import {
  fetchStockSituation,
  fetchStockSummary,
  formatStockQuantity,
  STOCK_STATUS_LABELS,
  type StockSituationRow,
  type StockStatus,
  type StockSummary,
} from '../lib/stock'
import { ApiError } from '../lib/api'
import { formatCurrency } from '../lib/format'
import { RowActionsMenu, type RowAction } from '../components/RowActionsMenu'
import { StockMovementModal, type StockMovementMode } from '../components/stock/StockMovementModal'
import { ClipboardCheckIcon, ClockIcon, PencilIcon, PlusIcon, SearchIcon, ArrowDownCircleIcon, ArrowUpCircleIcon } from '../components/icons'
import type { AuthCompany, AuthSession } from '../lib/auth'

interface StockPageProps {
  session: AuthSession
  company: AuthCompany
  onOpenInventory: () => void
  onOpenMovements: (product?: { id: string; name: string }) => void
  onEditProduct: (id: string) => void
}

const TYPE_FILTERS = [
  { value: '', label: 'Tudo' },
  { value: 'ingredient', label: 'Insumos' },
  { value: 'product', label: 'Produtos' },
]

const STATUS_FILTERS = [
  { value: '', label: 'Todos' },
  { value: 'low', label: 'Baixo' },
  { value: 'empty', label: 'Zerado' },
  { value: 'negative', label: 'Negativo' },
]

function statusTone(status: StockStatus) {
  if (status === 'negative') return 'bg-[var(--red-100)] text-[var(--red-500)]'
  if (status === 'empty') return 'bg-[var(--red-100)] text-[var(--red-500)]'
  if (status === 'low') return 'bg-[var(--amber-100)] text-[var(--amber-500)]'
  return 'bg-[var(--green-100)] text-[var(--green-600)]'
}

function quantityTone(status: StockStatus) {
  if (status === 'negative' || status === 'empty') return 'text-[var(--red-500)]'
  if (status === 'low') return 'text-[var(--amber-500)]'
  return 'text-[var(--ink)]'
}

function SummaryCard({
  label,
  value,
  hint,
  tone = 'default',
  active,
  onClick,
}: {
  label: string
  value: string
  hint: string
  tone?: 'default' | 'warn' | 'bad'
  active?: boolean
  onClick?: () => void
}) {
  const color = tone === 'bad' ? 'text-[var(--red-500)]' : tone === 'warn' ? 'text-[var(--amber-500)]' : 'text-[var(--ink)]'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`rounded-2xl border bg-[var(--surface)] p-4 text-left transition ${
        active ? 'border-[var(--blue-500)] ring-1 ring-[var(--blue-500)]' : 'border-[var(--border)]'
      } ${onClick ? 'hover:border-[var(--blue-300)]' : 'cursor-default'}`}
    >
      <p className="text-[12px] font-semibold text-[var(--ink-soft)]">{label}</p>
      <p className={`mt-1 text-[24px] font-bold tracking-tight ${color}`}>{value}</p>
      <p className="mt-0.5 text-[11.5px] text-[var(--muted)]">{hint}</p>
    </button>
  )
}

export function StockPage({ session, company, onOpenInventory, onOpenMovements, onEditProduct }: StockPageProps) {
  const token = session.token.token
  const [search, setSearch] = useState('')
  const [type, setType] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<StockSituationRow[]>([])
  const [meta, setMeta] = useState({ total: 0, lastPage: 1 })
  const [summary, setSummary] = useState<StockSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [movement, setMovement] = useState<{ mode: StockMovementMode; item: StockSituationRow | null } | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const reload = useCallback(() => setReloadKey((key) => key + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    const timeout = setTimeout(() => {
      Promise.all([
        fetchStockSituation(token, company.id, { search: search.trim() || undefined, type, status, page, limit: 15 }),
        fetchStockSummary(token, company.id),
      ])
        .then(([situation, nextSummary]) => {
          if (cancelled) return
          setRows(situation.data)
          setMeta({ total: situation.meta?.total ?? situation.data.length, lastPage: situation.meta?.last_page ?? 1 })
          setSummary(nextSummary)
        })
        .catch((err) => {
          if (!cancelled) setError(err instanceof ApiError ? err.message : 'Não foi possível carregar o estoque.')
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [token, company.id, search, type, status, page, reloadKey])

  function pickStatus(value: string) {
    setPage(1)
    setStatus((current) => (current === value ? '' : value))
  }

  function actionsFor(row: StockSituationRow): RowAction[] {
    return [
      { key: 'entry', label: 'Registrar entrada', icon: <ArrowUpCircleIcon className="h-4 w-4" />, onClick: () => setMovement({ mode: 'entry', item: row }) },
      { key: 'exit', label: 'Registrar saída ou perda', icon: <ArrowDownCircleIcon className="h-4 w-4" />, onClick: () => setMovement({ mode: 'exit', item: row }) },
      { key: 'moves', label: 'Ver movimentações', icon: <ClockIcon className="h-4 w-4" />, onClick: () => onOpenMovements({ id: row.id, name: row.name }) },
      { key: 'edit', label: 'Editar o item', icon: <PencilIcon className="h-4 w-4" />, dividerBefore: true, onClick: () => onEditProduct(row.id) },
    ]
  }

  const quantityLabel = (row: StockSituationRow) =>
    row.has_recipe ? (
      <span className="text-[var(--ink)]">
        {row.producible ?? 0}
        <span className="ml-1 text-[11px] font-normal text-[var(--muted)]">pode fazer</span>
      </span>
    ) : (
      <span className={quantityTone(row.stock_status)}>
        {formatStockQuantity(row.available_stock)}
        {row.unit ? <span className="ml-1 text-[11px] font-normal text-[var(--muted)]">{row.unit}</span> : null}
      </span>
    )

  return (
    <div className="flex w-full flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Estoque</p>
          <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">Situação do estoque</h1>
          <p className="mt-1 max-w-[760px] text-[13px] text-[var(--ink-soft)]">
            Veja quanto você tem de cada produto e insumo. As vendas descontam sozinhas (os produtos com ficha técnica descontam os insumos). Use os botões ao lado para dar entrada na mercadoria que chegou ou registrar perdas.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setMovement({ mode: 'entry', item: null })}
            className="flex items-center gap-2 rounded-xl bg-[var(--blue-500)] px-4 py-2.5 text-[13.5px] font-bold text-white transition hover:bg-[var(--blue-700)]"
          >
            <PlusIcon className="h-4 w-4" />
            Entrada de mercadoria
          </button>
          <button
            type="button"
            onClick={() => setMovement({ mode: 'exit', item: null })}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13.5px] font-bold text-[var(--blue-700)] ring-1 ring-[var(--blue-300)] hover:bg-[var(--blue-100)]"
          >
            <ArrowDownCircleIcon className="h-4 w-4" />
            Perda ou saída
          </button>
          <button
            type="button"
            onClick={onOpenInventory}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13.5px] font-bold text-[var(--blue-700)] ring-1 ring-[var(--blue-300)] hover:bg-[var(--blue-100)]"
          >
            <ClipboardCheckIcon className="h-4 w-4" />
            Fazer contagem
          </button>
        </div>
      </div>

      {summary && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <SummaryCard label="Itens controlados" value={String(summary.items)} hint={`${summary.ingredients} insumos`} />
          <SummaryCard
            label="Estoque baixo"
            value={String(summary.low)}
            hint="Abaixo do mínimo"
            tone={summary.low ? 'warn' : 'default'}
            active={status === 'low'}
            onClick={() => pickStatus('low')}
          />
          <SummaryCard
            label="Zerados"
            value={String(summary.empty)}
            hint="Insumos e itens com mínimo"
            tone={summary.empty ? 'bad' : 'default'}
            active={status === 'empty'}
            onClick={() => pickStatus('empty')}
          />
          <SummaryCard
            label="Negativos"
            value={String(summary.negative)}
            hint="Vendeu mais do que tinha lançado"
            tone={summary.negative ? 'bad' : 'default'}
            active={status === 'negative'}
            onClick={() => pickStatus('negative')}
          />
          <SummaryCard label="Valor em estoque" value={formatCurrency(summary.stock_value)} hint="Pelo custo médio" />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5">
          <SearchIcon className="h-4 w-4 flex-none text-[var(--muted)]" />
          <input
            type="text"
            placeholder="Buscar por nome ou código de barras"
            value={search}
            onChange={(event) => {
              setPage(1)
              setSearch(event.target.value)
            }}
            className="w-full bg-transparent text-[13.5px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none"
          />
        </div>
        <div className="flex gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1">
          {TYPE_FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setPage(1)
                setType(option.value)
              }}
              className={`rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition ${
                type === option.value ? 'bg-[var(--blue-500)] text-white' : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1">
          {STATUS_FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setPage(1)
                setStatus(option.value)
              }}
              className={`rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition ${
                status === option.value ? 'bg-[var(--blue-500)] text-white' : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {notice && <p className="rounded-xl bg-[var(--green-100)] px-4 py-3 text-[13px] font-semibold text-[var(--green-600)]">{notice}</p>}
      {error && <div className="rounded-2xl bg-[var(--red-100)] p-4 text-[13.5px] font-medium text-[var(--red-500)]">{error}</div>}

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        {loading ? (
          <div className="flex flex-col gap-2.5">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-11 animate-pulse rounded-xl bg-[var(--page)]" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-[14px] font-semibold text-[var(--ink)]">Nenhum item encontrado</p>
            <p className="mt-1 text-[13px] text-[var(--muted)]">
              {search || type || status
                ? 'Tente mudar a busca ou os filtros.'
                : 'Cadastre os produtos e insumos em Produtos e Serviços. Eles aparecem aqui.'}
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2.5 sm:hidden">
              {rows.map((row) => (
                <div key={row.id} className="rounded-xl border border-[var(--border)] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-bold text-[var(--ink)]">{row.name}</p>
                      <p className="mt-0.5 text-[12px] text-[var(--muted)]">
                        {row.is_ingredient ? 'Insumo' : 'Produto'}
                        {row.min_stock !== null ? ` · mínimo ${formatStockQuantity(row.min_stock)}` : ''}
                      </p>
                    </div>
                    <span className={`flex-none rounded-full px-2.5 py-1 text-[10.5px] font-bold ${statusTone(row.stock_status)}`}>
                      {STOCK_STATUS_LABELS[row.stock_status]}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[15px] font-bold">{quantityLabel(row)}</span>
                    <RowActionsMenu actions={actionsFor(row)} />
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                    <th className="pb-2.5 pl-3">Item</th>
                    <th className="pb-2.5 text-right">Saldo</th>
                    <th className="pb-2.5 text-right">Mínimo</th>
                    <th className="pb-2.5 text-right">Custo médio</th>
                    <th className="pb-2.5 text-right">Valor em estoque</th>
                    <th className="pb-2.5 pl-4">Situação</th>
                    <th className="pb-2.5 pr-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={row.id} className={`border-b border-[var(--border)] last:border-none ${index % 2 === 1 ? 'bg-[var(--page)]' : ''}`}>
                      <td className="py-2.5 pl-3">
                        <p className="font-medium text-[var(--ink)]">{row.name}</p>
                        <p className="text-[11.5px] text-[var(--muted)]">
                          {row.is_ingredient ? 'Insumo' : 'Produto'}
                          {row.has_recipe ? ' · tem ficha técnica' : ''}
                        </p>
                      </td>
                      <td className="py-2.5 text-right font-bold whitespace-nowrap">{quantityLabel(row)}</td>
                      <td className="py-2.5 text-right whitespace-nowrap text-[var(--ink-soft)]">
                        {row.min_stock !== null ? formatStockQuantity(row.min_stock) : '—'}
                      </td>
                      <td className="py-2.5 text-right whitespace-nowrap text-[var(--ink-soft)]">
                        {row.average_cost > 0 ? formatCurrency(row.average_cost) : '—'}
                      </td>
                      <td className="py-2.5 text-right whitespace-nowrap text-[var(--ink-soft)]">
                        {row.has_recipe ? '—' : formatCurrency(row.stock_value)}
                      </td>
                      <td className="py-2.5 pl-4">
                        {row.has_recipe ? (
                          <span className="text-[12px] text-[var(--muted)]">Pelos insumos</span>
                        ) : (
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusTone(row.stock_status)}`}>
                            {STOCK_STATUS_LABELS[row.stock_status]}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-right">
                        <RowActionsMenu actions={actionsFor(row)} />
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
            <p className="text-[12px] text-[var(--muted)]">{meta.total} itens no total</p>
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

      <StockMovementModal
        open={Boolean(movement)}
        mode={movement?.mode ?? 'entry'}
        initialItem={movement?.item ?? null}
        session={session}
        company={company}
        onClose={() => setMovement(null)}
        onSaved={(message) => {
          setNotice(message)
          reload()
        }}
      />
    </div>
  )
}
