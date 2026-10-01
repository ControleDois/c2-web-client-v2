import { useEffect, useState } from 'react'
import {
  fetchInvestments,
  deleteInvestment,
  INVESTMENT_TYPE_LABELS,
  type InvestmentRecord,
} from '../lib/investments'
import { ApiError } from '../lib/api'
import { formatCurrency, formatDate } from '../lib/format'
import { SearchIcon, PlusIcon, PencilIcon, TrashIcon, TrendUpIcon } from '../components/icons'
import { Select } from '../components/form/Select'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { RowActionsMenu, type RowAction } from '../components/RowActionsMenu'
import type { AuthSession, AuthCompany } from '../lib/auth'

interface InvestmentsPageProps {
  session: AuthSession
  company: AuthCompany
  onCreate: () => void
  onEdit: (investment: InvestmentRecord) => void
}

export function InvestmentsPage({ session, company, onCreate, onEdit }: InvestmentsPageProps) {
  const token = session.token.token
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('ativo')
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<InvestmentRecord[]>([])
  const [meta, setMeta] = useState({ total: 0, lastPage: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<InvestmentRecord | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  function load() {
    setLoading(true)
    setError(null)
    fetchInvestments(token, company.id, {
      search: search || undefined,
      status: status || undefined,
      page,
      limit: 20,
    })
      .then((res) => {
        setItems(res.data)
        setMeta({ total: res.meta?.total ?? res.data.length, lastPage: res.meta?.last_page ?? 1 })
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Não foi possível carregar os investimentos.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [token, company.id, search, status, page])

  async function handleDelete() {
    if (!deleteTarget) return
    setBusy(true)
    setActionError(null)
    try {
      await deleteInvestment(token, deleteTarget.id)
      setDeleteTarget(null)
      load()
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Não foi possível excluir o investimento.')
    } finally {
      setBusy(false)
    }
  }

  function buildActions(investment: InvestmentRecord): RowAction[] {
    return [
      { key: 'edit', label: 'Editar', icon: <PencilIcon className="h-4 w-4" />, onClick: () => onEdit(investment) },
      {
        key: 'delete',
        label: 'Excluir',
        icon: <TrashIcon className="h-4 w-4" />,
        tone: 'danger',
        dividerBefore: true,
        onClick: () => setDeleteTarget(investment),
      },
    ]
  }

  const totalAplicado = items.reduce((a, x) => a + Number(x.invested_amount || 0), 0)
  const totalAtual = items.reduce(
    (a, x) => a + (x.status === 'encerrado' ? 0 : Number(x.current_amount ?? x.invested_amount ?? 0)),
    0
  )

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Investimentos</p>
          <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">Outros Investimentos</h1>
        </div>
        <button
          type="button"
          onClick={onCreate}
          className="flex items-center gap-2 rounded-xl bg-[var(--blue-500)] px-4 py-2.5 text-[13.5px] font-bold text-white transition hover:bg-[var(--blue-700)]"
        >
          <PlusIcon className="h-4 w-4" />
          Novo investimento
        </button>
      </div>

      <div className="kpis grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">Valor atual (ativos)</p>
          <p className="mt-1 text-[18px] font-bold text-[var(--ink)]">{formatCurrency(totalAtual)}</p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">Total aplicado</p>
          <p className="mt-1 text-[18px] font-bold text-[var(--ink)]">{formatCurrency(totalAplicado)}</p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 col-span-2 sm:col-span-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">Investimentos nesta lista</p>
          <p className="mt-1 text-[18px] font-bold text-[var(--ink)]">{meta.total}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5">
          <SearchIcon className="h-4 w-4 flex-none text-[var(--muted)]" />
          <input
            type="text"
            placeholder="Buscar por nome ou contraparte"
            value={search}
            onChange={(event) => {
              setPage(1)
              setSearch(event.target.value)
            }}
            className="w-full bg-transparent text-[13.5px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none"
          />
        </div>
        <div className="w-full sm:w-56">
          <Select
            value={status}
            onChange={(value) => {
              setPage(1)
              setStatus(value)
            }}
          >
            <option value="">Todos</option>
            <option value="ativo">Ativos</option>
            <option value="encerrado">Encerrados</option>
          </Select>
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
            Nenhum investimento encontrado{search ? ` para "${search}"` : ''}.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                  <th className="pb-2.5 pl-3">Investimento</th>
                  <th className="pb-2.5">Tipo</th>
                  <th className="pb-2.5">Início</th>
                  <th className="pb-2.5 text-right">Aplicado</th>
                  <th className="pb-2.5 text-right">Valor atual</th>
                  <th className="pb-2.5 pr-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {items.map((investment, index) => (
                  <tr
                    key={investment.id}
                    onClick={() => onEdit(investment)}
                    className={`cursor-pointer border-b border-[var(--border)] transition-colors last:border-none hover:bg-[var(--blue-100)] ${
                      index % 2 === 1 ? 'bg-[var(--page)]' : ''
                    }`}
                  >
                    <td className="py-2.5 pl-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[var(--accent-soft,var(--blue-100))] text-[var(--blue-700)]">
                          <TrendUpIcon className="h-4 w-4" />
                        </span>
                        <div>
                          <p className="font-semibold text-[var(--ink)]">{investment.name}</p>
                          <p className="text-[11.5px] text-[var(--muted)]">{investment.counterparty || ''}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 text-[var(--ink-soft)]">
                      {INVESTMENT_TYPE_LABELS[investment.type] || investment.type}
                      {investment.status === 'encerrado' && (
                        <span className="ml-2 rounded-full bg-[var(--page)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--muted)]">
                          Encerrado
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 whitespace-nowrap text-[var(--ink-soft)]">{formatDate(investment.start_date)}</td>
                    <td className="py-2.5 text-right font-mono font-semibold text-[var(--ink)]">
                      {formatCurrency(Number(investment.invested_amount || 0))}
                    </td>
                    <td className="py-2.5 text-right font-mono font-semibold text-[var(--ink)]">
                      {investment.status === 'encerrado'
                        ? formatCurrency(Number(investment.redemption_amount || 0))
                        : formatCurrency(Number(investment.current_amount ?? investment.invested_amount ?? 0))}
                    </td>
                    <td className="py-2.5 pr-3 text-right" onClick={(event) => event.stopPropagation()}>
                      <RowActionsMenu actions={buildActions(investment)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && meta.lastPage > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-[12px] text-[var(--muted)]">{meta.total} investimentos no total</p>
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
        title="Excluir investimento"
        message={`Tem certeza que deseja excluir "${deleteTarget?.name ?? ''}"? Essa ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        loading={busy}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {actionError && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-[var(--red-500)] px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg">
          {actionError}
        </div>
      )}
    </div>
  )
}
