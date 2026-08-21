import { Fragment, useEffect, useState } from 'react'
import { fetchAuditLogs, auditActionLabel, AUDIT_ACTION_LABELS, type AuditLogRecord } from '../lib/auditLogs'
import { formatDateTime } from '../lib/format'
import { ApiError } from '../lib/api'
import { SearchIcon, ChevronDownIcon, RouteIcon } from '../components/icons'
import type { AuthSession, AuthCompany } from '../lib/auth'

interface AuditLogsPageProps {
  session: AuthSession
  company: AuthCompany
}

function firstDayOfMonth(): string {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
}

function lastDayOfMonth(): string {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)
}

function actionTone(action: string): string {
  if (action.endsWith('_error')) return 'bg-[var(--red-100)] text-[var(--red-500)]'
  if (action === 'create') return 'bg-[var(--green-100)] text-[var(--green-600)]'
  if (action === 'delete') return 'bg-[var(--red-100)] text-[var(--red-500)]'
  if (action === 'status_change') return 'bg-[var(--amber-100)] text-[var(--amber-500)]'
  return 'bg-[var(--blue-100)] text-[var(--blue-700)]'
}

export function AuditLogsPage({ session, company }: AuditLogsPageProps) {
  const [search, setSearch] = useState('')
  const [action, setAction] = useState('')
  const [dateStart, setDateStart] = useState(firstDayOfMonth())
  const [dateEnd, setDateEnd] = useState(lastDayOfMonth())
  const [page, setPage] = useState(1)

  const [items, setItems] = useState<AuditLogRecord[]>([])
  const [meta, setMeta] = useState({ total: 0, lastPage: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const timeout = setTimeout(() => {
      fetchAuditLogs(session.token.token, company.id, {
        search: search || undefined,
        action: action || undefined,
        dateStart: dateStart || undefined,
        dateEnd: dateEnd || undefined,
        page,
        limit: 20,
      })
        .then((res) => {
          if (cancelled) return
          setItems(res.data || [])
          setMeta({ total: res.meta?.total ?? res.data?.length ?? 0, lastPage: res.meta?.last_page ?? 1 })
        })
        .catch((err) => {
          if (cancelled) return
          setError(err instanceof ApiError ? err.message : 'Não foi possível carregar os logs do sistema.')
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 350)

    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [search, action, dateStart, dateEnd, page, company.id, session.token.token, refreshKey])

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Acessos</p>
          <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">Logs do Sistema</h1>
        </div>
        <button
          type="button"
          onClick={() => setRefreshKey((key) => key + 1)}
          className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-[13.5px] font-bold text-[var(--ink-soft)] hover:text-[var(--ink)]"
        >
          Atualizar
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5">
          <SearchIcon className="h-4 w-4 flex-none text-[var(--muted)]" />
          <input
            type="text"
            placeholder="Buscar por descrição, usuário ou entidade"
            value={search}
            onChange={(event) => {
              setPage(1)
              setSearch(event.target.value)
            }}
            className="w-full bg-transparent text-[13.5px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none"
          />
        </div>
        <input
          type="date"
          value={dateStart}
          onChange={(event) => {
            setPage(1)
            setDateStart(event.target.value)
          }}
          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-[13px] text-[var(--ink-soft)] focus:outline-none"
        />
        <input
          type="date"
          value={dateEnd}
          onChange={(event) => {
            setPage(1)
            setDateEnd(event.target.value)
          }}
          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-[13px] text-[var(--ink-soft)] focus:outline-none"
        />
        <div className="relative flex w-full items-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 sm:w-56">
          <select
            value={action}
            onChange={(event) => {
              setPage(1)
              setAction(event.target.value)
            }}
            className="w-full appearance-none bg-transparent text-[13.5px] font-semibold text-[var(--ink-soft)] focus:outline-none"
          >
            <option value="">Todas ações</option>
            {Object.entries(AUDIT_ACTION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <ChevronDownIcon className="pointer-events-none h-3.5 w-3.5 flex-none text-[var(--muted)]" />
        </div>
      </div>

      {error && (
        <div className="rounded-2xl bg-[var(--red-100)] p-4 text-[13.5px] font-medium text-[var(--red-500)]">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        {loading ? (
          <div className="flex flex-col gap-2.5">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-11 animate-pulse rounded-xl bg-[var(--page)]" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="py-10 text-center text-[13.5px] text-[var(--muted)]">Nenhum log encontrado para o período selecionado.</p>
        ) : (
          <>
            <div className="flex flex-col gap-2.5 sm:hidden">
              {items.map((item) => {
                const expanded = expandedId === item.id
                return (
                  <div key={item.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="min-w-0 truncate text-[13.5px] font-bold text-[var(--ink)]">
                          {item.people_name ?? item.people?.name ?? '—'}
                        </p>
                        <p className="mt-0.5 text-[12px] text-[var(--muted)]">{formatDateTime(item.created_at)}</p>
                      </div>
                      <span className={`flex-none rounded-full px-2.5 py-1 text-[10.5px] font-bold ${actionTone(item.action)}`}>
                        {auditActionLabel(item.action)}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[12.5px] text-[var(--ink)]">{item.description ?? '—'}</p>
                    {item.entity_type && (
                      <p className="text-[12px] text-[var(--muted)]">
                        {item.entity_type}
                        {item.entity_id ? ` #${item.entity_id.slice(0, 8)}` : ''}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : item.id)}
                      className="mt-2 inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] font-bold text-[var(--blue-700)] hover:bg-[var(--blue-100)]"
                    >
                      <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                      {expanded ? 'Ocultar detalhes' : 'Ver detalhes'}
                    </button>
                    {expanded && (
                      <div className="mt-2 rounded-lg bg-[var(--page)] p-3">
                        <div className="grid gap-3">
                          <div>
                            <p className="mb-1 text-[11px] font-bold tracking-wide text-[var(--muted)] uppercase">Rota</p>
                            <p className="font-mono text-[12px] text-[var(--muted)]">{item.method} {item.path}</p>
                          </div>
                          <div>
                            <p className="mb-1 text-[11px] font-bold tracking-wide text-[var(--muted)] uppercase">Origem</p>
                            <p className="text-[12.5px] text-[var(--ink)]">IP: {item.ip ?? '—'}</p>
                            <p className="truncate text-[12px] text-[var(--muted)]" title={item.user_agent ?? ''}>
                              {item.user_agent ?? '—'}
                            </p>
                          </div>
                          <div>
                            <p className="mb-1 text-[11px] font-bold tracking-wide text-[var(--muted)] uppercase">Status</p>
                            <p className="text-[12.5px] text-[var(--ink)]">HTTP {item.status_code ?? '—'}</p>
                            <p className="text-[12px] text-[var(--muted)]">Módulo: {item.module ?? '—'}</p>
                          </div>
                        </div>

                        {item.metadata?.changes && item.metadata.changes.length > 0 && (
                          <div className="mt-4">
                            <p className="mb-2 text-[11px] font-bold tracking-wide text-[var(--muted)] uppercase">
                              Alterações realizadas
                            </p>
                            <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
                              <table className="w-full min-w-[420px] border-collapse text-[12px]">
                                <thead>
                                  <tr className="bg-[var(--surface)] text-left text-[10.5px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                                    <th className="px-3 py-2">Campo</th>
                                    <th className="px-3 py-2">Antes</th>
                                    <th className="px-3 py-2">Depois</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {item.metadata.changes.map((change, changeIndex) => (
                                    <tr key={changeIndex} className="border-t border-[var(--border)] bg-[var(--surface)]">
                                      <td className="px-3 py-2 font-semibold text-[var(--ink)]">{change.label ?? change.field}</td>
                                      <td className="px-3 py-2 text-[var(--muted)]">{String(change.oldValue ?? '—')}</td>
                                      <td className="px-3 py-2 text-[var(--ink)]">{String(change.newValue ?? '—')}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {(item.new_values || item.old_values) && (
                          <div className="mt-4 flex flex-col gap-3">
                            {item.new_values && (
                              <div>
                                <p className="mb-1 flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-[var(--muted)] uppercase">
                                  <RouteIcon className="h-3 w-3" /> Dados enviados
                                </p>
                                <pre className="max-h-48 overflow-auto rounded-xl bg-[var(--surface)] p-3 text-[11px] text-[var(--ink-soft)]">
                                  {JSON.stringify(item.new_values, null, 2)}
                                </pre>
                              </div>
                            )}
                            {item.old_values && (
                              <div>
                                <p className="mb-1 text-[11px] font-bold tracking-wide text-[var(--muted)] uppercase">
                                  Dados anteriores
                                </p>
                                <pre className="max-h-48 overflow-auto rounded-xl bg-[var(--surface)] p-3 text-[11px] text-[var(--ink-soft)]">
                                  {JSON.stringify(item.old_values, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
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
                  <th className="pb-2.5 pl-3">Data</th>
                  <th className="pb-2.5">Usuário</th>
                  <th className="pb-2.5">Ação</th>
                  <th className="pb-2.5">Descrição</th>
                  <th className="pb-2.5">Rota</th>
                  <th className="pb-2.5 pr-3 text-right">Detalhes</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => {
                  const expanded = expandedId === item.id
                  return (
                    <Fragment key={item.id}>
                      <tr
                        className={`border-b border-[var(--border)] transition-colors last:border-none hover:bg-[var(--blue-100)] ${
                          index % 2 === 1 ? 'bg-[var(--page)]' : ''
                        }`}
                      >
                        <td className="py-2.5 pl-3 whitespace-nowrap text-[var(--ink-soft)]">{formatDateTime(item.created_at)}</td>
                        <td className="py-2.5">
                          <p className="font-medium text-[var(--ink)]">{item.people_name ?? item.people?.name ?? '—'}</p>
                          {(item.people_email ?? item.people?.email) && (
                            <p className="text-[12px] text-[var(--muted)]">{item.people_email ?? item.people?.email}</p>
                          )}
                        </td>
                        <td className="py-2.5">
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${actionTone(item.action)}`}>
                            {auditActionLabel(item.action)}
                          </span>
                        </td>
                        <td className="py-2.5">
                          <p className="max-w-[260px] truncate text-[var(--ink)]">{item.description ?? '—'}</p>
                          {item.entity_type && (
                            <p className="text-[12px] text-[var(--muted)]">
                              {item.entity_type}
                              {item.entity_id ? ` #${item.entity_id.slice(0, 8)}` : ''}
                            </p>
                          )}
                        </td>
                        <td className="py-2.5 font-mono text-[12px] text-[var(--muted)]">
                          {item.method} {item.path}
                        </td>
                        <td className="py-2.5 pr-3 text-right">
                          <button
                            type="button"
                            onClick={() => setExpandedId(expanded ? null : item.id)}
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] font-bold text-[var(--blue-700)] hover:bg-[var(--blue-100)]"
                          >
                            <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                            {expanded ? 'Ocultar' : 'Detalhes'}
                          </button>
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="border-b border-[var(--border)] bg-[var(--page)]">
                          <td colSpan={6} className="p-4">
                            <div className="grid gap-4 sm:grid-cols-3">
                              <div>
                                <p className="mb-1 text-[11px] font-bold tracking-wide text-[var(--muted)] uppercase">Origem</p>
                                <p className="text-[12.5px] text-[var(--ink)]">IP: {item.ip ?? '—'}</p>
                                <p className="truncate text-[12px] text-[var(--muted)]" title={item.user_agent ?? ''}>
                                  {item.user_agent ?? '—'}
                                </p>
                              </div>
                              <div>
                                <p className="mb-1 text-[11px] font-bold tracking-wide text-[var(--muted)] uppercase">Status</p>
                                <p className="text-[12.5px] text-[var(--ink)]">HTTP {item.status_code ?? '—'}</p>
                                <p className="text-[12px] text-[var(--muted)]">Módulo: {item.module ?? '—'}</p>
                              </div>
                              <div>
                                <p className="mb-1 text-[11px] font-bold tracking-wide text-[var(--muted)] uppercase">Entidade</p>
                                <p className="text-[12.5px] text-[var(--ink)]">{item.entity_type ?? '—'}</p>
                                <p className="truncate text-[12px] text-[var(--muted)]">{item.entity_id ?? '—'}</p>
                              </div>
                            </div>

                            {item.metadata?.changes && item.metadata.changes.length > 0 && (
                              <div className="mt-4">
                                <p className="mb-2 text-[11px] font-bold tracking-wide text-[var(--muted)] uppercase">
                                  Alterações realizadas
                                </p>
                                <div className="overflow-hidden rounded-xl border border-[var(--border)]">
                                  <table className="w-full border-collapse text-[12px]">
                                    <thead>
                                      <tr className="bg-[var(--surface)] text-left text-[10.5px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                                        <th className="px-3 py-2">Campo</th>
                                        <th className="px-3 py-2">Antes</th>
                                        <th className="px-3 py-2">Depois</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {item.metadata.changes.map((change, changeIndex) => (
                                        <tr key={changeIndex} className="border-t border-[var(--border)] bg-[var(--surface)]">
                                          <td className="px-3 py-2 font-semibold text-[var(--ink)]">{change.label ?? change.field}</td>
                                          <td className="px-3 py-2 text-[var(--muted)]">{String(change.oldValue ?? '—')}</td>
                                          <td className="px-3 py-2 text-[var(--ink)]">{String(change.newValue ?? '—')}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                            {(item.new_values || item.old_values) && (
                              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                {item.new_values && (
                                  <div>
                                    <p className="mb-1 flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-[var(--muted)] uppercase">
                                      <RouteIcon className="h-3 w-3" /> Dados enviados
                                    </p>
                                    <pre className="max-h-48 overflow-auto rounded-xl bg-[var(--surface)] p-3 text-[11px] text-[var(--ink-soft)]">
                                      {JSON.stringify(item.new_values, null, 2)}
                                    </pre>
                                  </div>
                                )}
                                {item.old_values && (
                                  <div>
                                    <p className="mb-1 text-[11px] font-bold tracking-wide text-[var(--muted)] uppercase">
                                      Dados anteriores
                                    </p>
                                    <pre className="max-h-48 overflow-auto rounded-xl bg-[var(--surface)] p-3 text-[11px] text-[var(--ink-soft)]">
                                      {JSON.stringify(item.old_values, null, 2)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
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
