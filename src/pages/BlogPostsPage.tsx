import { useCallback, useEffect, useState } from 'react'
import {
  BLOG_STATUS_LABELS,
  BLOG_URL,
  deleteBlogPost,
  fetchBlogPosts,
  type BlogPostRecord,
} from '../lib/blogPosts'
import { ApiError } from '../lib/api'
import { formatDate } from '../lib/format'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { SearchIcon, PencilIcon, PlusIcon, TrashIcon, EyeIcon } from '../components/icons'
import type { AuthSession } from '../lib/auth'

interface BlogPostsPageProps {
  session: AuthSession
  onCreate: () => void
  onEdit: (item: BlogPostRecord) => void
}

function statusTone(status: number): string {
  return status === 1 ? 'bg-[var(--green-100)] text-[var(--green-600)]' : 'bg-[var(--amber-100)] text-[var(--amber-500)]'
}

// Blog do site (blog.controledois.com.br): área da empresa matriz para escrever e publicar os artigos.
export function BlogPostsPage({ session, onCreate, onEdit }: BlogPostsPageProps) {
  const token = session.token.token
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<BlogPostRecord[]>([])
  const [meta, setMeta] = useState({ total: 0, lastPage: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<BlogPostRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    fetchBlogPosts(token, { search: search || undefined, status: status || undefined, page })
      .then((res) => {
        setItems(res.data)
        setMeta({ total: res.meta?.total ?? res.data.length, lastPage: res.meta?.last_page ?? 1 })
        setError(null)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Não foi possível carregar os artigos.'))
      .finally(() => setLoading(false))
  }, [token, search, status, page])

  useEffect(() => {
    const timer = setTimeout(load, search ? 300 : 0)
    return () => clearTimeout(timer)
  }, [load, search])

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteBlogPost(token, deleteTarget.id)
      setDeleteTarget(null)
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível excluir o artigo.')
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Matriz</p>
          <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">Blog</h1>
          <p className="mt-1 text-[12.5px] text-[var(--muted)]">
            Artigos de {BLOG_URL.replace(/^https?:\/\//, '')}. Só os publicados aparecem no site.
          </p>
        </div>
        <button
          type="button"
          onClick={onCreate}
          className="flex items-center gap-2 rounded-xl bg-[var(--blue-500)] px-4 py-2.5 text-[13.5px] font-bold text-white transition hover:bg-[var(--blue-700)]"
        >
          <PlusIcon className="h-4 w-4" />
          Novo artigo
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5">
          <SearchIcon className="h-4 w-4 flex-none text-[var(--muted)]" />
          <input
            type="text"
            placeholder="Buscar por título ou categoria"
            value={search}
            onChange={(event) => {
              setPage(1)
              setSearch(event.target.value)
            }}
            className="w-full bg-transparent text-[13.5px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none"
          />
        </div>
        <select
          value={status}
          onChange={(event) => {
            setPage(1)
            setStatus(event.target.value)
          }}
          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-[13.5px] text-[var(--ink)] focus:outline-none"
        >
          <option value="">Todos</option>
          <option value="1">Publicados</option>
          <option value="0">Rascunhos</option>
        </select>
      </div>

      {error && <div className="rounded-2xl bg-[var(--red-100)] p-4 text-[13.5px] font-medium text-[var(--red-500)]">{error}</div>}

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        {loading ? (
          <div className="flex flex-col gap-2.5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-14 animate-pulse rounded-xl bg-[var(--page)]" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="py-10 text-center text-[13.5px] text-[var(--muted)]">
            {search || status ? 'Nenhum artigo encontrado.' : 'Nenhum artigo ainda. Clique em "Novo artigo" para escrever o primeiro.'}
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-[var(--border)]">
            {items.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                {item.cover_url ? (
                  <img src={item.cover_url} alt="" className="h-12 w-20 flex-none rounded-lg object-cover" />
                ) : (
                  <div className="h-12 w-20 flex-none rounded-lg bg-[var(--blue-100)]" />
                )}
                <button type="button" onClick={() => onEdit(item)} className="min-w-0 flex-1 text-left">
                  <p className="truncate text-[14px] font-bold text-[var(--ink)]">{item.title}</p>
                  <p className="truncate text-[12px] text-[var(--muted)]">
                    /{item.slug}
                    {item.category ? ` · ${item.category}` : ''}
                    {item.published_at ? ` · ${formatDate(item.published_at)}` : ''}
                  </p>
                </button>
                <span className={`rounded-full px-2.5 py-1 text-[11.5px] font-bold ${statusTone(item.status)}`}>
                  {BLOG_STATUS_LABELS[item.status] ?? item.status}
                </span>
                <div className="flex items-center gap-1">
                  {item.status === 1 && (
                    <a
                      href={`${BLOG_URL}/${item.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      title="Ver no blog"
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--ink-soft)] hover:bg-[var(--page)] hover:text-[var(--ink)]"
                    >
                      <EyeIcon className="h-4 w-4" />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => onEdit(item)}
                    title="Editar"
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--ink-soft)] hover:bg-[var(--page)] hover:text-[var(--ink)]"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(item)}
                    title="Excluir"
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--red-500)] hover:bg-[var(--red-100)]"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {meta.lastPage > 1 && (
          <div className="mt-4 flex items-center justify-center gap-3 border-t border-[var(--border)] pt-4">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((value) => value - 1)}
              className="rounded-lg border border-[var(--border)] px-3.5 py-1.5 text-[13px] font-semibold text-[var(--ink-soft)] disabled:opacity-40"
            >
              Anterior
            </button>
            <span className="text-[12.5px] text-[var(--muted)]">
              Página {page} de {meta.lastPage} · {meta.total} artigos
            </span>
            <button
              type="button"
              disabled={page >= meta.lastPage}
              onClick={() => setPage((value) => value + 1)}
              className="rounded-lg border border-[var(--border)] px-3.5 py-1.5 text-[13px] font-semibold text-[var(--ink-soft)] disabled:opacity-40"
            >
              Próxima
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Excluir artigo"
        message={`Excluir "${deleteTarget?.title}"? Ele sai do blog e deixa de aparecer na lista.`}
        confirmLabel="Excluir"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
