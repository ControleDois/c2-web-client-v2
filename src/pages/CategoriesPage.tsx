import { useEffect, useRef, useState } from 'react'
import { fetchCategories, deleteCategory, deleteCategoriesSelected, CATEGORY_ROLE_LABELS, type CategoryRecord } from '../lib/categories'
import { ApiError } from '../lib/api'
import { getCached, setCached } from '../lib/cache'
import { useRowSelection } from '../hooks/useRowSelection'
import { SearchIcon, PlusIcon, PencilIcon, TrashIcon, PrinterIcon } from '../components/icons'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { PrintPreviewModal, type PrintColumn } from '../components/PrintPreviewModal'
import type { AuthSession, AuthCompany } from '../lib/auth'

interface CategoriesPageProps {
  session: AuthSession
  company: AuthCompany
  onCreate: () => void
  onEdit: (category: CategoryRecord) => void
}

const ROLE_FILTERS: { value: number | undefined; label: string }[] = [
  { value: undefined, label: 'Todas' },
  { value: 0, label: 'Despesa' },
  { value: 1, label: 'Receita' },
]

const PRINT_COLUMNS: PrintColumn[] = [
  { key: 'code', label: 'Código' },
  { key: 'name', label: 'Nome' },
  { key: 'parent', label: 'Categoria pai' },
  { key: 'role', label: 'Tipo' },
]

function roleTone(role?: number): string {
  return role === 1 ? 'bg-[var(--green-100)] text-[var(--green-600)]' : 'bg-[var(--red-100)] text-[var(--red-500)]'
}

export function CategoriesPage({ session, company, onCreate, onEdit }: CategoriesPageProps) {
  const [search, setSearch] = useState('')
  const [role, setRole] = useState<number | undefined>(undefined)
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<CategoryRecord[]>([])
  const [meta, setMeta] = useState({ total: 0, lastPage: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { selected, toggle, toggleAll, clear, setSelected } = useRowSelection()
  const [deleteTarget, setDeleteTarget] = useState<CategoryRecord | null>(null)
  const [deletingSelected, setDeletingSelected] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [printOpen, setPrintOpen] = useState(false)

  const [refreshKey, setRefreshKey] = useState(0)
  const skipCacheOnce = useRef(false)

  useEffect(() => {
    let cancelled = false
    const cacheKey = `categories:${company.id}:${role ?? 'all'}:${page}:${search}`
    const cached = skipCacheOnce.current ? undefined : getCached<{ items: CategoryRecord[]; meta: typeof meta }>(cacheKey)
    skipCacheOnce.current = false

    if (cached) {
      setItems(cached.items)
      setMeta(cached.meta)
      setLoading(false)
    } else {
      setLoading(true)
    }
    setError(null)

    const timeout = setTimeout(
      () => {
        fetchCategories(session.token.token, company.id, { search, role, page, limit: 10 })
          .then((res) => {
            if (cancelled) return
            const nextItems = res.data || []
            const nextMeta = { total: res.meta?.total ?? res.data?.length ?? 0, lastPage: res.meta?.last_page ?? 1 }
            setItems(nextItems)
            setMeta(nextMeta)
            setCached(cacheKey, { items: nextItems, meta: nextMeta })
            clear()
          })
          .catch((err) => {
            if (cancelled) return
            setError(err instanceof ApiError ? err.message : 'Não foi possível carregar as categorias.')
          })
          .finally(() => {
            if (!cancelled) setLoading(false)
          })
      },
      cached ? 0 : 350
    )

    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, role, page, company.id, session.token.token, refreshKey])

  function reload() {
    skipCacheOnce.current = true
    setRefreshKey((key) => key + 1)
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteCategory(session.token.token, deleteTarget.id)
      setDeleteTarget(null)
      reload()
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Não foi possível excluir a categoria.')
    } finally {
      setDeleting(false)
    }
  }

  async function handleConfirmDeleteSelected() {
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteCategoriesSelected(session.token.token, Array.from(selected))
      setDeletingSelected(false)
      setSelected(new Set())
      reload()
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Não foi possível excluir as categorias selecionadas.')
    } finally {
      setDeleting(false)
    }
  }

  const selectedItems = items.filter((item) => selected.has(item.id))
  const printRows = selectedItems.map((item) => ({
    code: `#${item.code}`,
    name: item.name,
    parent: item.category?.name ?? '—',
    role: CATEGORY_ROLE_LABELS[item.role ?? 0],
  }))

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Financeiro</p>
          <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">Categorias</h1>
        </div>
        <button
          type="button"
          onClick={onCreate}
          className="flex items-center gap-2 rounded-xl bg-[var(--blue-500)] px-4 py-2.5 text-[13.5px] font-bold text-white transition hover:bg-[var(--blue-700)]"
        >
          <PlusIcon className="h-4 w-4" />
          Nova categoria
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5">
          <SearchIcon className="h-4 w-4 flex-none text-[var(--muted)]" />
          <input
            type="text"
            placeholder="Buscar por nome"
            value={search}
            onChange={(event) => {
              setPage(1)
              setSearch(event.target.value)
            }}
            className="w-full bg-transparent text-[13.5px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none"
          />
        </div>

        <div className="flex gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1">
          {ROLE_FILTERS.map((option) => (
            <button
              key={option.label}
              type="button"
              onClick={() => {
                setPage(1)
                setRole(option.value)
              }}
              className={`rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition ${
                role === option.value ? 'bg-[var(--blue-500)] text-white' : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[var(--blue-100)] px-4 py-3">
          <span className="text-[13px] font-bold text-[var(--blue-700)]">
            {selected.size} selecionado{selected.size === 1 ? '' : 's'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPrintOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-[var(--surface)] px-3.5 py-2 text-[12.5px] font-bold text-[var(--blue-700)] hover:bg-white"
            >
              <PrinterIcon className="h-3.5 w-3.5" />
              Imprimir selecionados
            </button>
            <button
              type="button"
              onClick={() => setDeletingSelected(true)}
              className="flex items-center gap-1.5 rounded-xl bg-[var(--surface)] px-3.5 py-2 text-[12.5px] font-bold text-[var(--red-500)] hover:bg-white"
            >
              <TrashIcon className="h-3.5 w-3.5" />
              Excluir selecionados
            </button>
            <button
              type="button"
              onClick={clear}
              className="rounded-xl px-3.5 py-2 text-[12.5px] font-semibold text-[var(--blue-700)] hover:underline"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-2xl bg-[var(--red-100)] p-4 text-[13.5px] font-medium text-[var(--red-500)]">
          {error}
        </div>
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
            Nenhuma categoria encontrada{search ? ` para "${search}"` : ''}.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                  <th className="w-10 pb-2.5 pl-3">
                    <input
                      type="checkbox"
                      checked={items.length > 0 && items.every((i) => selected.has(i.id))}
                      onChange={() => toggleAll(items.map((i) => i.id))}
                      className="h-4 w-4 accent-[var(--blue-500)]"
                      aria-label="Selecionar todos"
                    />
                  </th>
                  <th className="pb-2.5">Código</th>
                  <th className="pb-2.5">Nome</th>
                  <th className="pb-2.5">Categoria pai</th>
                  <th className="pb-2.5">Tipo</th>
                  <th className="pb-2.5 pr-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr
                    key={item.id}
                    className={`border-b border-[var(--border)] transition-colors last:border-none hover:bg-[var(--blue-100)] ${
                      index % 2 === 1 ? 'bg-[var(--page)]' : ''
                    } ${selected.has(item.id) ? 'bg-[var(--blue-100)]' : ''}`}
                  >
                    <td className="py-2.5 pl-3">
                      <input
                        type="checkbox"
                        checked={selected.has(item.id)}
                        onChange={() => toggle(item.id)}
                        className="h-4 w-4 accent-[var(--blue-500)]"
                        aria-label={`Selecionar ${item.name}`}
                      />
                    </td>
                    <td className="py-2.5 font-mono text-[var(--ink-soft)]">#{item.code}</td>
                    <td className="py-2.5 font-medium text-[var(--ink)]">{item.name}</td>
                    <td className="py-2.5 text-[var(--ink-soft)]">{item.category?.name ?? '—'}</td>
                    <td className="py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase ${roleTone(item.role)}`}>
                        {CATEGORY_ROLE_LABELS[item.role ?? 0]}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => onEdit(item)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--ink)]"
                          aria-label="Editar"
                        >
                          <PencilIcon className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(item)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--red-100)] hover:text-[var(--red-500)]"
                          aria-label="Excluir"
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && meta.lastPage > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-[12px] text-[var(--muted)]">{meta.total} categorias no total</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
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
                onClick={() => setPage((p) => Math.min(meta.lastPage, p + 1))}
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
        title="Excluir categoria"
        message={`Tem certeza que deseja excluir "${deleteTarget?.name}"? Essa ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setDeleteTarget(null)
          setDeleteError(null)
        }}
      />

      <ConfirmDialog
        open={deletingSelected}
        title="Excluir selecionadas"
        message={`Tem certeza que deseja excluir ${selected.size} categoria${selected.size === 1 ? '' : 's'}? Essa ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        loading={deleting}
        onConfirm={handleConfirmDeleteSelected}
        onCancel={() => {
          setDeletingSelected(false)
          setDeleteError(null)
        }}
      />

      {deleteError && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-[var(--red-500)] px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg">
          {deleteError}
        </div>
      )}

      <PrintPreviewModal
        open={printOpen}
        company={company}
        title="Categorias"
        subtitle={`${company.people?.name ?? ''} · ${printRows.length} registro${printRows.length === 1 ? '' : 's'}`}
        columns={PRINT_COLUMNS}
        rows={printRows}
        onClose={() => setPrintOpen(false)}
      />
    </div>
  )
}
