import { useEffect, useState } from 'react'
import { deleteStockInventory, fetchStockInventories, type StockInventoryRecord } from '../lib/stock'
import { ApiError } from '../lib/api'
import { formatDateTime } from '../lib/format'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { RowActionsMenu, type RowAction } from '../components/RowActionsMenu'
import { ChevronLeftIcon, EyeIcon, PlusIcon, TrashIcon } from '../components/icons'
import type { AuthCompany, AuthSession } from '../lib/auth'

interface StockInventoriesPageProps {
  session: AuthSession
  company: AuthCompany
  onCreate: () => void
  onOpen: (inventory: StockInventoryRecord) => void
  onBack: () => void
}

export function StockInventoriesPage({ session, company, onCreate, onOpen, onBack }: StockInventoriesPageProps) {
  const token = session.token.token
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<StockInventoryRecord[]>([])
  const [meta, setMeta] = useState({ total: 0, lastPage: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<StockInventoryRecord | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchStockInventories(token, company.id, { page, limit: 10 })
      .then((res) => {
        if (cancelled) return
        setRows(res.data)
        setMeta({ total: res.meta?.total ?? res.data.length, lastPage: res.meta?.last_page ?? 1 })
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Não foi possível carregar as contagens.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token, company.id, page, reloadKey])

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteStockInventory(token, deleteTarget.id)
      setDeleteTarget(null)
      setReloadKey((key) => key + 1)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível excluir a contagem.')
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  function actionsFor(inventory: StockInventoryRecord): RowAction[] {
    return [
      { key: 'view', label: inventory.status === 1 ? 'Ver contagem' : 'Abrir e fechar', icon: <EyeIcon className="h-4 w-4" />, onClick: () => onOpen(inventory) },
      ...(inventory.status === 0
        ? [{ key: 'delete', label: 'Excluir rascunho', icon: <TrashIcon className="h-4 w-4" />, tone: 'danger' as const, dividerBefore: true, onClick: () => setDeleteTarget(inventory) }]
        : []),
    ]
  }

  const itemsOf = (inventory: StockInventoryRecord) => inventory.items?.length ?? 0
  const differencesOf = (inventory: StockInventoryRecord) =>
    (inventory.items ?? []).filter((item) => Number(item.difference_quantity) !== 0).length

  return (
    <div className="flex w-full flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="mb-3 flex items-center gap-1 text-[12.5px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]"
          >
            <ChevronLeftIcon className="h-3.5 w-3.5" />
            Voltar para a situação do estoque
          </button>
          <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Estoque</p>
          <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">Contagens (inventário)</h1>
          <p className="mt-1 max-w-[760px] text-[13px] text-[var(--ink-soft)]">
            A contagem serve para acertar o estoque com o que existe de verdade na prateleira. Você conta, digita as quantidades, e ao fechar o sistema ajusta o saldo. Faça uma contagem inicial para começar o controle.
          </p>
        </div>
        <button
          type="button"
          onClick={onCreate}
          className="flex items-center gap-2 rounded-xl bg-[var(--blue-500)] px-4 py-2.5 text-[13.5px] font-bold text-white transition hover:bg-[var(--blue-700)]"
        >
          <PlusIcon className="h-4 w-4" />
          Nova contagem
        </button>
      </div>

      {error && <div className="rounded-2xl bg-[var(--red-100)] p-4 text-[13.5px] font-medium text-[var(--red-500)]">{error}</div>}

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        {loading ? (
          <div className="flex flex-col gap-2.5">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-11 animate-pulse rounded-xl bg-[var(--page)]" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-[14px] font-semibold text-[var(--ink)]">Nenhuma contagem ainda</p>
            <p className="mt-1 text-[13px] text-[var(--muted)]">Toque em "Nova contagem" para contar o estoque e acertar os saldos.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                  <th className="pb-2.5 pl-3">Data</th>
                  <th className="pb-2.5">Descrição</th>
                  <th className="pb-2.5 text-right">Itens</th>
                  <th className="pb-2.5 text-right">Com diferença</th>
                  <th className="pb-2.5 pl-4">Situação</th>
                  <th className="pb-2.5 pr-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((inventory, index) => (
                  <tr
                    key={inventory.id}
                    onClick={() => onOpen(inventory)}
                    className={`cursor-pointer border-b border-[var(--border)] transition-colors last:border-none hover:bg-[var(--blue-100)] ${index % 2 === 1 ? 'bg-[var(--page)]' : ''}`}
                  >
                    <td className="py-2.5 pl-3 whitespace-nowrap text-[var(--ink-soft)]">{formatDateTime(inventory.inventory_at)}</td>
                    <td className="py-2.5 font-medium text-[var(--ink)]">{inventory.description || 'Contagem de estoque'}</td>
                    <td className="py-2.5 text-right text-[var(--ink-soft)]">{itemsOf(inventory)}</td>
                    <td className="py-2.5 text-right text-[var(--ink-soft)]">{differencesOf(inventory)}</td>
                    <td className="py-2.5 pl-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                          inventory.status === 1 ? 'bg-[var(--green-100)] text-[var(--green-600)]' : 'bg-[var(--amber-100)] text-[var(--amber-500)]'
                        }`}
                      >
                        {inventory.status === 1 ? 'Fechada' : 'Rascunho'}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-right" onClick={(event) => event.stopPropagation()}>
                      <RowActionsMenu actions={actionsFor(inventory)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && meta.lastPage > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-[12px] text-[var(--muted)]">{meta.total} contagens</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
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
                onClick={() => setPage((current) => Math.min(meta.lastPage, current + 1))}
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
        title="Excluir este rascunho?"
        message="O rascunho da contagem será apagado. O estoque não muda, porque ela ainda não foi fechada."
        confirmLabel="Excluir"
        cancelLabel="Voltar"
        loading={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
