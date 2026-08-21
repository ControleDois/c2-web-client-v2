import { useEffect, useState } from 'react'
import {
  fetchCompanyGroups,
  deleteCompanyGroup,
  companyGroupMemberName,
  SHARING_OPTIONS,
  type CompanyGroupRecord,
} from '../lib/companyGroups'
import { ApiError } from '../lib/api'
import { getCached, setCached } from '../lib/cache'
import { SearchIcon, PlusIcon, PencilIcon, TrashIcon } from '../components/icons'
import { ConfirmDialog } from '../components/ConfirmDialog'
import type { AuthSession, AuthCompany } from '../lib/auth'

interface CompanyGroupsPageProps {
  session: AuthSession
  company: AuthCompany
  onCreate: () => void
  onEdit: (group: CompanyGroupRecord) => void
}

export function CompanyGroupsPage({ session, company, onCreate, onEdit }: CompanyGroupsPageProps) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<CompanyGroupRecord[]>([])
  const [meta, setMeta] = useState({ total: 0, lastPage: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<CompanyGroupRecord | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const cacheKey = `company-groups:${company.id}:${page}:${search}`
    const cached = getCached<{ items: CompanyGroupRecord[]; meta: typeof meta }>(cacheKey)

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
        fetchCompanyGroups(session.token.token, company.id, { search, page, limit: 10 })
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
            setError(err instanceof ApiError ? err.message : 'Não foi possível carregar os grupos de empresas.')
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
  }, [search, page, company.id, session.token.token])

  function silentReload() {
    const cacheKey = `company-groups:${company.id}:${page}:${search}`
    fetchCompanyGroups(session.token.token, company.id, { search, page, limit: 10 })
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
      await deleteCompanyGroup(session.token.token, deletedId)
      setDeleteTarget(null)
      setItems((prev) => prev.filter((item) => item.id !== deletedId))
      setMeta((prev) => ({ ...prev, total: Math.max(0, prev.total - 1) }))
      silentReload()
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Não foi possível excluir o grupo.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Acessos</p>
          <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">Grupo de Empresas</h1>
        </div>
        <button
          type="button"
          onClick={onCreate}
          className="flex items-center gap-2 rounded-xl bg-[var(--blue-500)] px-4 py-2.5 text-[13.5px] font-bold text-white transition hover:bg-[var(--blue-700)]"
        >
          <PlusIcon className="h-4 w-4" />
          Novo grupo
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
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-14 animate-pulse rounded-xl bg-[var(--page)]" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="py-10 text-center text-[13.5px] text-[var(--muted)]">
            Nenhum grupo encontrado{search ? ` para "${search}"` : ''}.
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-2.5 sm:hidden">
              {items.map((item) => {
                const activeSharing = SHARING_OPTIONS.filter((option) => item.shared_data?.[option.key])
                return (
                  <div key={item.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 truncate text-[13.5px] font-bold text-[var(--ink)]">{item.name}</p>
                      <div className="flex flex-none items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onEdit(item)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--page)] hover:text-[var(--ink)]"
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
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(item.companies ?? []).length === 0 ? (
                        <span className="text-[12px] text-[var(--muted)]">Nenhuma empresa</span>
                      ) : (
                        item.companies!.map((member) => (
                          <span
                            key={member.id}
                            className="rounded-full bg-[var(--blue-100)] px-2 py-0.5 text-[11px] font-semibold text-[var(--blue-700)]"
                          >
                            {companyGroupMemberName(member)}
                          </span>
                        ))
                      )}
                    </div>
                    {activeSharing.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {activeSharing.map((option) => (
                          <span
                            key={option.key}
                            className="rounded-full bg-[var(--green-100)] px-2 py-0.5 text-[11px] font-semibold text-[var(--green-600)]"
                          >
                            {option.title}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                    <th className="pb-2.5 pl-3">Grupo</th>
                    <th className="pb-2.5">Empresas</th>
                    <th className="pb-2.5">Compartilhamento</th>
                    <th className="pb-2.5 pr-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => {
                    const activeSharing = SHARING_OPTIONS.filter((option) => item.shared_data?.[option.key])
                    return (
                      <tr
                        key={item.id}
                        className={`border-b border-[var(--border)] transition-colors last:border-none hover:bg-[var(--blue-100)] ${
                          index % 2 === 1 ? 'bg-[var(--page)]' : ''
                        }`}
                      >
                        <td className="py-2.5 pl-3 font-medium text-[var(--ink)]">{item.name}</td>
                        <td className="py-2.5">
                          <div className="flex flex-wrap gap-1">
                            {(item.companies ?? []).length === 0 ? (
                              <span className="text-[12px] text-[var(--muted)]">—</span>
                            ) : (
                              item.companies!.map((member) => (
                                <span
                                  key={member.id}
                                  className="rounded-full bg-[var(--blue-100)] px-2 py-0.5 text-[11px] font-semibold text-[var(--blue-700)]"
                                >
                                  {companyGroupMemberName(member)}
                                </span>
                              ))
                            )}
                          </div>
                        </td>
                        <td className="py-2.5">
                          <div className="flex flex-wrap gap-1">
                            {activeSharing.length === 0 ? (
                              <span className="text-[12px] text-[var(--muted)]">—</span>
                            ) : (
                              activeSharing.map((option) => (
                                <span
                                  key={option.key}
                                  className="rounded-full bg-[var(--green-100)] px-2 py-0.5 text-[11px] font-semibold text-[var(--green-600)]"
                                >
                                  {option.title}
                                </span>
                              ))
                            )}
                          </div>
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
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {!loading && meta.lastPage > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-[12px] text-[var(--muted)]">{meta.total} grupos no total</p>
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
        title="Excluir grupo"
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
