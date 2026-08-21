import { useEffect, useState } from 'react'
import { fetchUsers, type UserRecord } from '../lib/users'
import { ApiError } from '../lib/api'
import { getCached, setCached } from '../lib/cache'
import { SearchIcon, PlusIcon, PencilIcon, ChevronLeftIcon, UserIcon } from '../components/icons'
import type { AuthSession, AuthCompany } from '../lib/auth'

interface UsersPageProps {
  session: AuthSession
  company: AuthCompany
  onBack: () => void
  onCreate: () => void
  onEdit: (user: UserRecord) => void
}

export function UsersPage({ session, company, onBack, onCreate, onEdit }: UsersPageProps) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<UserRecord[]>([])
  const [meta, setMeta] = useState({ total: 0, lastPage: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const cacheKey = `users:${company.id}:${page}:${search}`
    const cached = getCached<{ items: UserRecord[]; meta: typeof meta }>(cacheKey)

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
        fetchUsers(session.token.token, company.id, { search, page, limit: 10 })
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
            setError(err instanceof ApiError ? err.message : 'Não foi possível carregar os usuários.')
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
  }, [search, page, company.id, session.token.token])

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div>
        <button
          type="button"
          onClick={onBack}
          className="mb-3 flex items-center gap-1 text-[12.5px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]"
        >
          <ChevronLeftIcon className="h-3.5 w-3.5" />
          Voltar
        </button>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Conta</p>
            <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">Usuários</h1>
          </div>
          <button
            type="button"
            onClick={onCreate}
            className="flex items-center gap-2 rounded-xl bg-[var(--blue-500)] px-4 py-2.5 text-[13.5px] font-bold text-white transition hover:bg-[var(--blue-700)]"
          >
            <PlusIcon className="h-4 w-4" />
            Novo usuário
          </button>
        </div>
      </div>

      <div className="flex min-w-[240px] items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5">
        <SearchIcon className="h-4 w-4 flex-none text-[var(--muted)]" />
        <input
          type="text"
          placeholder="Buscar por nome ou código interno"
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
            Nenhum usuário encontrado{search ? ` para "${search}"` : ''}.
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-2.5 sm:hidden">
              {items.map((item) => (
                <div key={item.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
                  <div className="flex items-start gap-2.5">
                    <span className="flex h-9 w-9 flex-none items-center justify-center overflow-hidden rounded-full bg-[var(--blue-100)] text-[var(--blue-700)]">
                      {item.file_url ? (
                        <img src={item.file_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <UserIcon className="h-4 w-4" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="min-w-0 truncate text-[13.5px] font-bold text-[var(--ink)]">{item.name}</p>
                      <p className="mt-0.5 text-[12px] text-[var(--muted)]">
                        {item.internal_code != null ? `#${item.internal_code}` : '—'} · {item.user?.email ?? '—'}
                      </p>
                      <p className="text-[12px] text-[var(--ink-soft)]">{item.role?.name ?? '—'}</p>
                      <div className="mt-2.5 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onEdit(item)}
                          className="flex items-center gap-1.5 rounded-lg bg-[var(--page)] px-3 py-1.5 text-[12px] font-semibold text-[var(--ink-soft)]"
                        >
                          <PencilIcon className="h-3.5 w-3.5" />
                          Editar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                    <th className="w-12 pb-2.5 pl-3" />
                    <th className="pb-2.5">Código</th>
                    <th className="pb-2.5">Nome</th>
                    <th className="pb-2.5">E-mail</th>
                    <th className="pb-2.5">Perfil de acesso</th>
                    <th className="pb-2.5 pr-3 text-right">Ações</th>
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
                      <td className="py-2.5 pl-3">
                        <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[var(--blue-100)] text-[var(--blue-700)]">
                          {item.file_url ? (
                            <img src={item.file_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <UserIcon className="h-4 w-4" />
                          )}
                        </span>
                      </td>
                      <td className="py-2.5 font-mono text-[var(--ink-soft)]">
                        {item.internal_code != null ? `#${item.internal_code}` : '—'}
                      </td>
                      <td className="py-2.5 font-medium text-[var(--ink)]">{item.name}</td>
                      <td className="py-2.5 text-[var(--ink-soft)]">{item.user?.email ?? '—'}</td>
                      <td className="py-2.5 text-[var(--ink-soft)]">{item.role?.name ?? '—'}</td>
                      <td className="py-2.5 pr-3 text-right">
                        <button
                          type="button"
                          onClick={() => onEdit(item)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--page)] hover:text-[var(--ink)]"
                          aria-label="Editar"
                        >
                          <PencilIcon className="h-3.5 w-3.5" />
                        </button>
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
            <p className="text-[12px] text-[var(--muted)]">{meta.total} usuários no total</p>
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
    </div>
  )
}
