import { useEffect, useState } from 'react'
import {
  fetchCategoryProducts,
  createCategoryProduct,
  updateCategoryProduct,
  deleteCategoryProduct,
  type CategoryProductRecord,
} from '../../lib/categoryProducts'
import { ApiError } from '../../lib/api'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { SearchIcon, PlusIcon, PencilIcon, TrashIcon, CheckCircleIcon, CloseIcon } from '../../components/icons'
import type { AuthSession, AuthCompany } from '../../lib/auth'

interface CategoriasProdutoSectionProps {
  session: AuthSession
  company: AuthCompany
}

export function CategoriasProdutoSection({ session, company }: CategoriasProdutoSectionProps) {
  const [categories, setCategories] = useState<CategoryProductRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [savingNew, setSavingNew] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<CategoryProductRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    if (!feedback) return
    const timeout = setTimeout(() => setFeedback(null), 3200)
    return () => clearTimeout(timeout)
  }, [feedback])

  function load() {
    setLoading(true)
    setError(null)
    fetchCategoryProducts(session.token.token, company.id, { limit: 200 })
      .then((res) => setCategories(res.data))
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : 'Não foi possível carregar as categorias de produto.')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.token.token, company.id])

  const filtered = categories.filter((category) =>
    search.trim() ? category.name.toLowerCase().includes(search.trim().toLowerCase()) : true
  )

  async function handleCreate() {
    const name = newName.trim()
    if (!name) return
    setSavingNew(true)
    try {
      const created = await createCategoryProduct(session.token.token, { company_id: company.id, name })
      setCategories((prev) => [created, ...prev])
      setNewName('')
      setCreating(false)
    } catch (err) {
      setFeedback({
        tone: 'error',
        message: err instanceof ApiError ? err.message : 'Não foi possível criar a categoria.',
      })
    } finally {
      setSavingNew(false)
    }
  }

  function startEditing(category: CategoryProductRecord) {
    setEditingId(category.id)
    setEditingName(category.name)
  }

  async function handleSaveEdit(category: CategoryProductRecord) {
    const name = editingName.trim()
    if (!name || name === category.name) {
      setEditingId(null)
      return
    }
    setSavingEdit(true)
    try {
      const updated = await updateCategoryProduct(session.token.token, category.id, {
        company_id: company.id,
        name,
      })
      setCategories((prev) => prev.map((c) => (c.id === category.id ? updated : c)))
      setEditingId(null)
    } catch (err) {
      setFeedback({
        tone: 'error',
        message: err instanceof ApiError ? err.message : 'Não foi possível salvar a categoria.',
      })
    } finally {
      setSavingEdit(false)
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteCategoryProduct(session.token.token, deleteTarget.id)
      setCategories((prev) => prev.filter((c) => c.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (err) {
      setFeedback({
        tone: 'error',
        message: err instanceof ApiError ? err.message : 'Não foi possível excluir a categoria.',
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[12.5px] text-[var(--muted)]">
        Categorias usadas para organizar os produtos (ex: na Gestão de Compras, os itens serão
        agrupados por categoria).
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--page)] px-3.5 py-2.5">
          <SearchIcon className="h-4 w-4 flex-none text-[var(--muted)]" />
          <input
            type="text"
            placeholder="Buscar categoria"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full bg-transparent text-[13.5px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none"
          />
        </div>
        {!creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 rounded-xl bg-[var(--blue-500)] px-4 py-2.5 text-[13px] font-bold text-white transition hover:bg-[var(--blue-700)]"
          >
            <PlusIcon className="h-4 w-4" />
            Nova categoria
          </button>
        )}
      </div>

      {creating && (
        <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--page)] p-2.5">
          <input
            type="text"
            autoFocus
            placeholder="Nome da categoria"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && handleCreate()}
            className="w-full rounded-lg bg-[var(--surface)] px-3 py-2 text-[13.5px] text-[var(--ink)] ring-1 ring-transparent placeholder:text-[var(--muted)] focus:outline-none focus:ring-[var(--blue-300)]"
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={!newName.trim() || savingNew}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--blue-500)] px-3.5 py-2 text-[12.5px] font-bold text-white disabled:opacity-60"
          >
            <CheckCircleIcon className="h-3.5 w-3.5" />
            {savingNew ? 'Salvando…' : 'Salvar'}
          </button>
          <button
            type="button"
            onClick={() => {
              setCreating(false)
              setNewName('')
            }}
            className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--ink)]"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-[var(--red-100)] p-3 text-[13px] font-medium text-[var(--red-500)]">{error}</div>
      )}

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-11 animate-pulse rounded-xl bg-[var(--page)]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-[var(--muted)]">
          Nenhuma categoria de produto {search ? `para "${search}"` : 'cadastrada ainda'}.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {filtered.map((category) => (
            <div
              key={category.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5"
            >
              {editingId === category.id ? (
                <>
                  <input
                    type="text"
                    autoFocus
                    value={editingName}
                    onChange={(event) => setEditingName(event.target.value)}
                    onKeyDown={(event) => event.key === 'Enter' && handleSaveEdit(category)}
                    className="w-full rounded-lg bg-[var(--page)] px-3 py-1.5 text-[13.5px] text-[var(--ink)] ring-1 ring-transparent focus:outline-none focus:ring-[var(--blue-300)]"
                  />
                  <div className="flex items-center gap-1 flex-none">
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(category)}
                      disabled={savingEdit}
                      className="rounded-lg p-1.5 text-[var(--blue-700)] hover:bg-[var(--blue-100)] disabled:opacity-60"
                    >
                      <CheckCircleIcon className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--page)]"
                    >
                      <CloseIcon className="h-4 w-4" />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <span className="text-[13.5px] font-semibold text-[var(--ink)]">{category.name}</span>
                  <div className="flex items-center gap-1 flex-none">
                    <button
                      type="button"
                      onClick={() => startEditing(category)}
                      className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--page)] hover:text-[var(--ink)]"
                    >
                      <PencilIcon className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(category)}
                      className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--page)] hover:text-[var(--red-500)]"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Excluir categoria"
        message={`Tem certeza que deseja excluir a categoria "${deleteTarget?.name}"? Essa ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        danger
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

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
