import { useEffect, useRef, useState } from 'react'
import {
  fetchContractTemplates,
  createContractTemplate,
  deleteContractTemplate,
  TARGET_TYPE_LABELS,
  type ContractTemplateRecord,
} from '../lib/contractTemplates'
import { ApiError } from '../lib/api'
import { getCached, setCached } from '../lib/cache'
import { SearchIcon, PlusIcon, PencilIcon, TrashIcon, CopyIcon, ChevronDownIcon } from '../components/icons'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { RowActionsMenu, type RowAction } from '../components/RowActionsMenu'
import type { AuthSession, AuthCompany } from '../lib/auth'

interface ContractTemplatesPageProps {
  session: AuthSession
  company: AuthCompany
  onCreate: () => void
  onEdit: (template: ContractTemplateRecord) => void
}

const TARGET_TYPE_FILTERS: { value: string | undefined; label: string }[] = [
  { value: undefined, label: 'Todos' },
  ...Object.entries(TARGET_TYPE_LABELS).map(([value, label]) => ({ value, label })),
]

export function ContractTemplatesPage({ session, company, onCreate, onEdit }: ContractTemplatesPageProps) {
  const [search, setSearch] = useState('')
  const [targetType, setTargetType] = useState<string | undefined>(undefined)
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<ContractTemplateRecord[]>([])
  const [meta, setMeta] = useState({ total: 0, lastPage: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<ContractTemplateRecord | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null)

  const [refreshKey, setRefreshKey] = useState(0)
  const skipCacheOnce = useRef(false)

  useEffect(() => {
    let cancelled = false
    const cacheKey = `contract-templates:${company.id}:${targetType ?? 'all'}:${page}:${search}`
    const cached = skipCacheOnce.current ? undefined : getCached<{ items: ContractTemplateRecord[]; meta: typeof meta }>(cacheKey)
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
        fetchContractTemplates(session.token.token, company.id, { search, targetType, page, limit: 10 })
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
            setError(err instanceof ApiError ? err.message : 'Não foi possível carregar os modelos de contrato.')
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
  }, [search, targetType, page, company.id, session.token.token, refreshKey])

  function reload() {
    skipCacheOnce.current = true
    setRefreshKey((key) => key + 1)
  }

  function silentReload() {
    const cacheKey = `contract-templates:${company.id}:${targetType ?? 'all'}:${page}:${search}`
    fetchContractTemplates(session.token.token, company.id, { search, targetType, page, limit: 10 })
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
      await deleteContractTemplate(session.token.token, deletedId)
      setDeleteTarget(null)
      setItems((prev) => prev.filter((item) => item.id !== deletedId))
      setMeta((prev) => ({ ...prev, total: Math.max(0, prev.total - 1) }))
      silentReload()
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Não foi possível excluir o modelo.')
    } finally {
      setDeleting(false)
    }
  }

  async function handleDuplicate(template: ContractTemplateRecord) {
    setDuplicatingId(template.id)
    setDeleteError(null)
    try {
      await createContractTemplate(session.token.token, {
        company_id: company.id,
        title: `${template.title} (cópia)`,
        target_type: template.target_type,
        description: template.description || undefined,
        html: template.html,
        signature_page: template.signature_page,
        signature_x: template.signature_x,
        signature_y: template.signature_y,
        is_active: false,
      })
      reload()
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Não foi possível duplicar o modelo.')
    } finally {
      setDuplicatingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Conta</p>
          <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">Modelos de Contrato</h1>
          <p className="mt-1 text-[13px] text-[var(--muted)]">Cadastre contratos reutilizáveis para envio de assinatura digital.</p>
        </div>
        <button
          type="button"
          onClick={onCreate}
          className="flex items-center gap-2 rounded-xl bg-[var(--blue-500)] px-4 py-2.5 text-[13.5px] font-bold text-white transition hover:bg-[var(--blue-700)]"
        >
          <PlusIcon className="h-4 w-4" />
          Novo modelo
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5">
          <SearchIcon className="h-4 w-4 flex-none text-[var(--muted)]" />
          <input
            type="text"
            placeholder="Buscar por título ou descrição"
            value={search}
            onChange={(event) => {
              setPage(1)
              setSearch(event.target.value)
            }}
            className="w-full bg-transparent text-[13.5px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none"
          />
        </div>

        <div className="relative flex w-full items-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 sm:w-56">
          <select
            value={targetType ?? ''}
            onChange={(event) => {
              setPage(1)
              setTargetType(event.target.value || undefined)
            }}
            className="w-full appearance-none bg-transparent text-[13.5px] font-semibold text-[var(--ink-soft)] focus:outline-none"
          >
            {TARGET_TYPE_FILTERS.map((option) => (
              <option key={option.label} value={option.value ?? ''}>
                {option.label}
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
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-11 animate-pulse rounded-xl bg-[var(--page)]" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="py-10 text-center text-[13.5px] text-[var(--muted)]">
            Nenhum modelo de contrato encontrado{search ? ` para "${search}"` : ''}.
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-2.5 sm:hidden">
              {items.map((item) => {
                const actions: RowAction[] = [
                  { key: 'edit', label: 'Editar', icon: <PencilIcon className="h-4 w-4" />, onClick: () => onEdit(item) },
                  {
                    key: 'duplicate',
                    label: duplicatingId === item.id ? 'Duplicando…' : 'Duplicar',
                    icon: <CopyIcon className="h-4 w-4" />,
                    onClick: () => handleDuplicate(item),
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
                        <p className="min-w-0 truncate text-[13.5px] font-bold text-[var(--ink)]">{item.title}</p>
                        <p className="mt-0.5 text-[12px] text-[var(--muted)]">
                          {item.internal_code ? `#${item.internal_code}` : '—'} · {TARGET_TYPE_LABELS[item.target_type] ?? item.target_type}
                        </p>
                      </div>
                      <RowActionsMenu actions={actions} />
                    </div>
                    <span
                      className={`mt-2 inline-block rounded-full px-2.5 py-1 text-[10.5px] font-bold ${
                        item.is_active
                          ? 'bg-[var(--green-100)] text-[var(--green-600)]'
                          : 'bg-[var(--red-100)] text-[var(--red-500)]'
                      }`}
                    >
                      {item.is_active ? 'Ativo' : 'Inativo'}
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
                    <th className="pb-2.5">Título</th>
                    <th className="pb-2.5">Tipo</th>
                    <th className="pb-2.5">Status</th>
                    <th className="pb-2.5 pr-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => {
                    const actions: RowAction[] = [
                      { key: 'edit', label: 'Editar', icon: <PencilIcon className="h-4 w-4" />, onClick: () => onEdit(item) },
                      {
                        key: 'duplicate',
                        label: duplicatingId === item.id ? 'Duplicando…' : 'Duplicar',
                        icon: <CopyIcon className="h-4 w-4" />,
                        onClick: () => handleDuplicate(item),
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
                        <td className="py-2.5 pl-3 font-mono text-[var(--ink-soft)]">
                          {item.internal_code ? `#${item.internal_code}` : '—'}
                        </td>
                        <td className="py-2.5">
                          <p className="font-medium text-[var(--ink)]">{item.title}</p>
                          {item.description && (
                            <p className="truncate text-[12px] text-[var(--muted)]">{item.description}</p>
                          )}
                        </td>
                        <td className="py-2.5 text-[var(--ink-soft)]">{TARGET_TYPE_LABELS[item.target_type] ?? item.target_type}</td>
                        <td className="py-2.5">
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                              item.is_active
                                ? 'bg-[var(--green-100)] text-[var(--green-600)]'
                                : 'bg-[var(--red-100)] text-[var(--red-500)]'
                            }`}
                          >
                            {item.is_active ? 'Ativo' : 'Inativo'}
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
            <p className="text-[12px] text-[var(--muted)]">{meta.total} modelos no total</p>
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
        title="Excluir modelo"
        message={`Tem certeza que deseja excluir "${deleteTarget?.title}"? Essa ação não pode ser desfeita.`}
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
