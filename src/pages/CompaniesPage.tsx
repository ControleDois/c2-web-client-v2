import { useEffect, useState } from 'react'
import { fetchCompanies, type CompanyRecord } from '../lib/companies'
import { formatDocument } from '../lib/formatDocument'
import { ApiError } from '../lib/api'
import { getCached, setCached } from '../lib/cache'
import { SearchIcon, PlusIcon, PencilIcon, ChevronLeftIcon } from '../components/icons'
import type { AuthSession } from '../lib/auth'

interface CompaniesPageProps {
  session: AuthSession
  onBack: () => void
  onCreate: () => void
  onEdit: (company: CompanyRecord) => void
}

function statusTone(active?: boolean): string {
  return active === false ? 'bg-[var(--red-100)] text-[var(--red-500)]' : 'bg-[var(--green-100)] text-[var(--green-600)]'
}

export function CompaniesPage({ session, onBack, onCreate, onEdit }: CompaniesPageProps) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<CompanyRecord[]>([])
  const [meta, setMeta] = useState({ total: 0, lastPage: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const cacheKey = `companies:${session.user.id}:${page}:${search}`
    const cached = getCached<{ items: CompanyRecord[]; meta: typeof meta }>(cacheKey)

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
        fetchCompanies(session.token.token, { search, page, limit: 200 })
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
            setError(err instanceof ApiError ? err.message : 'Não foi possível carregar as empresas.')
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
  }, [search, page, session.user.id, session.token.token])

  return (
    <div className="flex flex-col gap-6 p-8">
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
            <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">Empresas</h1>
          </div>
          <button
            type="button"
            onClick={onCreate}
            className="flex items-center gap-2 rounded-xl bg-[var(--blue-500)] px-4 py-2.5 text-[13.5px] font-bold text-white transition hover:bg-[var(--blue-700)]"
          >
            <PlusIcon className="h-4 w-4" />
            Nova empresa
          </button>
        </div>
      </div>

      <div className="flex min-w-[240px] items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5">
        <SearchIcon className="h-4 w-4 flex-none text-[var(--muted)]" />
        <input
          type="text"
          placeholder="Buscar por nome, código ou documento"
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
            Nenhuma empresa encontrada{search ? ` para "${search}"` : ''}.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                  <th className="pb-2.5 pl-3">Nome</th>
                  <th className="pb-2.5">Razão social</th>
                  <th className="pb-2.5">Documento</th>
                  <th className="pb-2.5">Status</th>
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
                    <td className="py-2.5 pl-3 font-medium text-[var(--ink)]">{item.name}</td>
                    <td className="py-2.5 text-[var(--ink-soft)]">{item.social_name || '—'}</td>
                    <td className="py-2.5 font-mono text-[var(--ink-soft)]">
                      {item.document ? formatDocument(item.document) : '—'}
                    </td>
                    <td className="py-2.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase ${statusTone(item.company?.active)}`}
                      >
                        {item.company?.active === false ? 'Desativada' : 'Ativa'}
                      </span>
                    </td>
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
        )}

        {!loading && meta.lastPage > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-[12px] text-[var(--muted)]">{meta.total} empresas no total</p>
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
