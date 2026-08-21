import { useEffect, useRef, useState } from 'react'
import { fetchRoles, fetchRole, createRole, deleteRole, type RoleRecord } from '../lib/roles'
import { SYSTEM_TYPE_LABELS } from '../lib/systemTypes'
import { ApiError } from '../lib/api'
import { getCached, setCached } from '../lib/cache'
import { SearchIcon, PlusIcon, PencilIcon, TrashIcon, CopyIcon } from '../components/icons'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { RowActionsMenu, type RowAction } from '../components/RowActionsMenu'
import type { AuthSession, AuthCompany } from '../lib/auth'

interface RolesPageProps {
  session: AuthSession
  company: AuthCompany
  onCreate: () => void
  onEdit: (role: RoleRecord) => void
}

export function RolesPage({ session, company, onCreate, onEdit }: RolesPageProps) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<RoleRecord[]>([])
  const [meta, setMeta] = useState({ total: 0, lastPage: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<RoleRecord | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [cloningId, setCloningId] = useState<string | null>(null)

  const [refreshKey, setRefreshKey] = useState(0)
  const skipCacheOnce = useRef(false)

  useEffect(() => {
    let cancelled = false
    const cacheKey = `roles:${company.id}:${page}:${search}`
    const cached = skipCacheOnce.current ? undefined : getCached<{ items: RoleRecord[]; meta: typeof meta }>(cacheKey)
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
        fetchRoles(session.token.token, company.id, { search, page, limit: 10 })
          .then((res) => {
            if (cancelled) return
            const nextItems = res.data || []
            const nextMeta = { total: res.meta?.total ?? res.data?.length ?? 0, lastPage: res.meta?.last_page ?? 1 }
            setItems(nextItems)
            setMeta(nextMeta)
            setCached(cacheKey, { items: nextItems, meta: nextMeta })
          })
          .catch((err) => {
            if (cancelled) return
            setError(err instanceof ApiError ? err.message : 'Não foi possível carregar os perfis de acesso.')
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
  }, [search, page, company.id, session.token.token, refreshKey])

  function reload() {
    skipCacheOnce.current = true
    setRefreshKey((key) => key + 1)
  }

  function silentReload() {
    const cacheKey = `roles:${company.id}:${page}:${search}`
    fetchRoles(session.token.token, company.id, { search, page, limit: 10 })
      .then((res) => {
        const nextItems = res.data || []
        const nextMeta = { total: res.meta?.total ?? res.data?.length ?? 0, lastPage: res.meta?.last_page ?? 1 }
        setItems(nextItems)
        setMeta(nextMeta)
        setCached(cacheKey, { items: nextItems, meta: nextMeta })
      })
      .catch(() => {})
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    const deletedId = deleteTarget.id
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteRole(session.token.token, deletedId)
      setDeleteTarget(null)
      setItems((prev) => prev.filter((item) => item.id !== deletedId))
      setMeta((prev) => ({ ...prev, total: Math.max(0, prev.total - 1) }))
      silentReload()
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Não foi possível excluir o perfil.')
    } finally {
      setDeleting(false)
    }
  }

  async function handleClone(role: RoleRecord) {
    setCloningId(role.id)
    setDeleteError(null)
    try {
      const full = await fetchRole(session.token.token, role.id)
      await createRole(session.token.token, {
        name: `${full.name} (Cópia)`,
        description: full.description ?? '',
        system_type: full.system_type ?? 0,
        permissions: (full.permissions ?? []).map((permission) => permission.id),
      })
      reload()
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Não foi possível clonar o perfil.')
    } finally {
      setCloningId(null)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Acessos</p>
          <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">Perfis de Acesso</h1>
        </div>
        <button
          type="button"
          onClick={onCreate}
          className="flex items-center gap-2 rounded-xl bg-[var(--blue-500)] px-4 py-2.5 text-[13.5px] font-bold text-white transition hover:bg-[var(--blue-700)]"
        >
          <PlusIcon className="h-4 w-4" />
          Novo perfil
        </button>
      </div>

      <div className="flex min-w-[240px] items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5">
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
            Nenhum perfil encontrado{search ? ` para "${search}"` : ''}.
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-2.5 sm:hidden">
              {items.map((item) => {
                const actions: RowAction[] = [
                  { key: 'edit', label: 'Editar', icon: <PencilIcon className="h-4 w-4" />, onClick: () => onEdit(item) },
                  {
                    key: 'clone',
                    label: cloningId === item.id ? 'Clonando…' : 'Clonar',
                    icon: <CopyIcon className="h-4 w-4" />,
                    onClick: () => handleClone(item),
                  },
                  {
                    key: 'delete',
                    label: 'Excluir',
                    icon: <TrashIcon className="h-4 w-4" />,
                    tone: 'danger',
                    dividerBefore: true,
                    onClick: () => setDeleteTarget(item),
                  },
                ]

                return (
                  <div key={item.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="min-w-0 truncate text-[13.5px] font-bold text-[var(--ink)]">{item.name}</p>
                        <p className="mt-0.5 text-[12px] text-[var(--muted)]">#{item.code}</p>
                      </div>
                      <RowActionsMenu actions={actions} />
                    </div>
                    <span
                      className={`mt-2 inline-block rounded-full px-2.5 py-1 text-[10.5px] font-bold ${
                        item.system_type === 0
                          ? 'bg-[var(--red-100)] text-[var(--red-500)]'
                          : 'bg-[var(--green-100)] text-[var(--green-600)]'
                      }`}
                    >
                      {SYSTEM_TYPE_LABELS[item.system_type ?? 0] ?? '—'}
                    </span>
                  </div>
                )
              })}
            </div>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                    <th className="pb-2.5 pl-3">Código</th>
                    <th className="pb-2.5">Nome</th>
                    <th className="pb-2.5">Tipo Sistema</th>
                    <th className="pb-2.5 pr-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => {
                    const actions: RowAction[] = [
                      { key: 'edit', label: 'Editar', icon: <PencilIcon className="h-4 w-4" />, onClick: () => onEdit(item) },
                      {
                        key: 'clone',
                        label: cloningId === item.id ? 'Clonando…' : 'Clonar',
                        icon: <CopyIcon className="h-4 w-4" />,
                        onClick: () => handleClone(item),
                      },
                      {
                        key: 'delete',
                        label: 'Excluir',
                        icon: <TrashIcon className="h-4 w-4" />,
                        tone: 'danger',
                        dividerBefore: true,
                        onClick: () => setDeleteTarget(item),
                      },
                    ]

                    return (
                      <tr
                        key={item.id}
                        className={`border-b border-[var(--border)] transition-colors last:border-none hover:bg-[var(--blue-100)] ${
                          index % 2 === 1 ? 'bg-[var(--page)]' : ''
                        }`}
                      >
                        <td className="py-2.5 pl-3 font-mono text-[var(--ink-soft)]">#{item.code}</td>
                        <td className="py-2.5">
                          <p className="font-medium text-[var(--ink)]">{item.name}</p>
                          {item.description && <p className="truncate text-[12px] text-[var(--muted)]">{item.description}</p>}
                        </td>
                        <td className="py-2.5">
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                              item.system_type === 0
                                ? 'bg-[var(--red-100)] text-[var(--red-500)]'
                                : 'bg-[var(--green-100)] text-[var(--green-600)]'
                            }`}
                          >
                            {SYSTEM_TYPE_LABELS[item.system_type ?? 0] ?? '—'}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3 text-right">
                          <RowActionsMenu actions={actions} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {!loading && meta.lastPage > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-[12px] text-[var(--muted)]">{meta.total} perfis no total</p>
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
        title="Excluir perfil"
        message={`Tem certeza que deseja excluir "${deleteTarget?.name}"? Essa ação não pode ser desfeita.`}
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
