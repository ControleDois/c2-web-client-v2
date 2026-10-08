import { useEffect, useState, type ReactNode } from 'react'
import { ApiError } from '../../lib/api'
import type { Paginated } from '../../lib/glass'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { RowActionsMenu, type RowAction } from '../../components/RowActionsMenu'
import { PlusIcon, SearchIcon } from '../../components/icons'

export interface GlassColumn<T> {
  header: string
  render: (item: T) => ReactNode
  align?: 'right'
}

interface GlassListProps<T extends { id: string }> {
  eyebrow: string
  title: string
  newLabel?: string
  searchPlaceholder: string
  emptyLabel: string
  columns: GlassColumn<T>[]
  cardTitle: (item: T) => ReactNode
  cardSubtitle: (item: T) => ReactNode
  fetchPage: (search: string, page: number) => Promise<Paginated<T>>
  // Muda quando filtros externos mudam, para recarregar a lista da primeira página.
  filterKey?: string
  filters?: ReactNode
  // Conteúdo logo abaixo do título (ex: guia de uso), antes da busca e da tabela.
  beforeContent?: ReactNode
  // Dentro de outra tela (abas): sem título, botão de novo nem margens próprias.
  embedded?: boolean
  // Sem onCreate, a lista é só de consulta (sem botão de novo).
  onCreate?: () => void
  actions: (item: T, helpers: { reload: () => void; askDelete: (item: T) => void }) => RowAction[]
  deleteItem: (item: T) => Promise<unknown>
  deleteTitle: string
  deleteLabel: (item: T) => string
}

export function GlassList<T extends { id: string }>({
  eyebrow,
  title,
  newLabel,
  searchPlaceholder,
  emptyLabel,
  columns,
  cardTitle,
  cardSubtitle,
  fetchPage,
  filterKey = '',
  filters,
  beforeContent,
  embedded = false,
  onCreate,
  actions,
  deleteItem,
  deleteTitle,
  deleteLabel,
}: GlassListProps<T>) {
  const [items, setItems] = useState<T[]>([])
  const [meta, setMeta] = useState({ total: 0, lastPage: 1 })
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [deleteTarget, setDeleteTarget] = useState<T | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    setPage(1)
  }, [filterKey])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    const timeout = setTimeout(() => {
      fetchPage(search, page)
        .then((res) => {
          if (cancelled) return
          setItems(res.data || [])
          setMeta({ total: res.meta?.total ?? res.data?.length ?? 0, lastPage: res.meta?.last_page ?? 1 })
        })
        .catch((err) => {
          if (!cancelled) setError(err instanceof ApiError ? err.message : 'Não foi possível carregar a lista.')
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, page, filterKey, reloadKey])

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteItem(deleteTarget)
      setDeleteTarget(null)
      setReloadKey((key) => key + 1)
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Não foi possível excluir.')
    } finally {
      setDeleting(false)
    }
  }

  const helpers = { reload: () => setReloadKey((key) => key + 1), askDelete: (item: T) => setDeleteTarget(item) }

  return (
    <div className={embedded ? 'flex flex-col gap-4' : 'flex flex-col gap-6 p-4 sm:p-6 lg:p-8'}>
      {!embedded && (
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">{eyebrow}</p>
          <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">{title}</h1>
        </div>
        {onCreate && (
          <button
            type="button"
            onClick={onCreate}
            className="flex items-center gap-2 rounded-xl bg-[var(--blue-500)] px-4 py-2.5 text-[13.5px] font-bold text-white transition hover:bg-[var(--blue-700)]"
          >
            <PlusIcon className="h-4 w-4" />
            {newLabel}
          </button>
        )}
      </div>
      )}

      {beforeContent}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5">
          <SearchIcon className="h-4 w-4 flex-none text-[var(--muted)]" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(event) => {
              setPage(1)
              setSearch(event.target.value)
            }}
            className="w-full bg-transparent text-[13.5px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none"
          />
        </div>
        {filters}
      </div>

      {error && (
        <div className="rounded-2xl bg-[var(--red-100)] p-4 text-[13.5px] font-medium text-[var(--red-500)]">{error}</div>
      )}

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        {loading ? (
          <div className="flex flex-col gap-2.5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-11 animate-pulse rounded-xl bg-[var(--page)]" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="py-10 text-center text-[13.5px] text-[var(--muted)]">
            {emptyLabel}
            {search ? ` para "${search}"` : ''}.
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-2.5 sm:hidden">
              {items.map((item) => (
                <div key={item.id} className="flex items-start gap-2 rounded-xl border border-[var(--border)] p-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-bold text-[var(--ink)]">{cardTitle(item)}</div>
                    <div className="mt-0.5 text-[12px] text-[var(--muted)]">{cardSubtitle(item)}</div>
                  </div>
                  <RowActionsMenu actions={actions(item, helpers)} />
                </div>
              ))}
            </div>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                    {columns.map((column) => (
                      <th key={column.header} className={`pb-2.5 pl-3 ${column.align === 'right' ? 'text-right' : ''}`}>
                        {column.header}
                      </th>
                    ))}
                    <th className="w-12 pb-2.5 pr-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr
                      key={item.id}
                      className={`border-b border-[var(--border)] transition-colors last:border-none hover:bg-[var(--blue-100)] ${
                        index % 2 === 1 ? 'bg-[var(--page)]' : ''
                      }`}
                    >
                      {columns.map((column) => (
                        <td key={column.header} className={`py-2.5 pl-3 ${column.align === 'right' ? 'text-right' : ''}`}>
                          {column.render(item)}
                        </td>
                      ))}
                      <td className="py-2.5 pr-3 text-right">
                        <RowActionsMenu actions={actions(item, helpers)} />
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
            <p className="text-[12px] text-[var(--muted)]">{meta.total} registros no total</p>
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

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={deleteTitle}
        message={`Tem certeza que deseja excluir "${deleteTarget ? deleteLabel(deleteTarget) : ''}"? Essa ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setDeleteTarget(null)
          setDeleteError(null)
        }}
      />

      {deleteError && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-[var(--red-500)] px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg">
          {deleteError}
        </div>
      )}
    </div>
  )
}
