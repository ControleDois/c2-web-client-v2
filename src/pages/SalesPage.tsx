import { useEffect, useMemo, useState } from 'react'
import {
  deleteSale,
  fetchSale,
  fetchSales,
  SALE_STATUS_LABELS,
  type SaleBillRef,
  type SaleRecord,
} from '../lib/sales'
import { FORM_PAYMENT_LABELS } from '../lib/bills'
import { ApiError } from '../lib/api'
import { formatCurrency, formatDate, formatDateTime } from '../lib/format'
import { Select } from '../components/form/Select'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { RowActionsMenu, type RowAction } from '../components/RowActionsMenu'
import { CloseIcon, CoinIcon, EyeIcon, PencilIcon, PlusIcon, SearchIcon, TrashIcon } from '../components/icons'
import type { AuthCompany, AuthSession } from '../lib/auth'

interface SalesPageProps {
  session: AuthSession
  company: AuthCompany
  pdvUrl: string
  onCreate: () => void
  onEdit: (sale: SaleRecord) => void
}

const PAGE_SIZE = 10

// De onde a venda veio: o servidor grava isso na observação.
export function saleOrigin(sale: SaleRecord): string {
  const note = String(sale.note ?? '').toLowerCase()
  if (note.includes('venda rápida')) return 'PDV · Venda rápida'
  if (note.includes('pdv food')) return 'PDV · Mesa'
  if (note.includes('delivery')) return 'Delivery'
  return 'Painel'
}

function statusTone(status: number) {
  if (status === 3) return 'bg-[var(--green-100)] text-[var(--green-600)]'
  if (status === 2) return 'bg-[var(--red-100)] text-[var(--red-500)]'
  if (status === 4) return 'bg-[var(--indigo-100)] text-[var(--indigo-500)]'
  return 'bg-[var(--amber-100)] text-[var(--amber-500)]'
}

// Venda que já recebeu pagamento não se edita (o dinheiro já entrou): só cancelar e refazer.
export function saleHasReceivedBill(bills?: SaleBillRef[] | null): boolean {
  return (bills ?? []).some((bill) => Number(bill.status) === 1)
}

const STATUS_FILTERS = [
  { value: '', label: 'Todas as situações' },
  { value: '3', label: 'Vendas' },
  { value: '0,1,2', label: 'Orçamentos' },
]

export function SalesPage({ session, company, pdvUrl, onCreate, onEdit }: SalesPageProps) {
  const token = session.token.token
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [dateStart, setDateStart] = useState('')
  const [dateEnd, setDateEnd] = useState('')
  const [page, setPage] = useState(1)
  const [sales, setSales] = useState<SaleRecord[]>([])
  const [meta, setMeta] = useState({ total: 0, lastPage: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [detail, setDetail] = useState<SaleRecord | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [cancelTarget, setCancelTarget] = useState<SaleRecord | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    const timeout = setTimeout(() => {
      fetchSales(token, company.id, {
        search: search.trim() || undefined,
        status: status || undefined,
        role: 1,
        dateStart: dateStart || undefined,
        dateEnd: dateEnd || undefined,
        withBills: true,
        page,
        limit: PAGE_SIZE,
      })
        .then((res) => {
          if (cancelled) return
          setSales(res.data)
          setMeta({ total: res.meta?.total ?? res.data.length, lastPage: res.meta?.last_page ?? 1 })
        })
        .catch((err) => {
          if (!cancelled) setError(err instanceof ApiError ? err.message : 'Não foi possível carregar as vendas.')
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [token, company.id, search, status, dateStart, dateEnd, page, reloadKey])

  function openDetail(sale: SaleRecord) {
    setDetail(sale)
    setLoadingDetail(true)
    fetchSale(token, sale.id)
      .then((full) => setDetail(full))
      .catch(() => {})
      .finally(() => setLoadingDetail(false))
  }

  async function handleCancel() {
    if (!cancelTarget) return
    setCancelling(true)
    try {
      await deleteSale(token, cancelTarget.id)
      setNotice(`Venda #${cancelTarget.code ?? ''} cancelada. As contas a receber em aberto dela também foram canceladas.`)
      setCancelTarget(null)
      setDetail(null)
      setReloadKey((key) => key + 1)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível cancelar a venda.')
      setCancelTarget(null)
    } finally {
      setCancelling(false)
    }
  }

  function canEdit(sale: SaleRecord) {
    return !saleHasReceivedBill(sale.bills)
  }

  function buildActions(sale: SaleRecord): RowAction[] {
    return [
      { key: 'view', label: 'Ver detalhes', icon: <EyeIcon className="h-4 w-4" />, onClick: () => openDetail(sale) },
      ...(canEdit(sale)
        ? [{ key: 'edit', label: 'Editar', icon: <PencilIcon className="h-4 w-4" />, onClick: () => onEdit(sale) }]
        : []),
      {
        key: 'cancel',
        label: 'Cancelar venda',
        icon: <TrashIcon className="h-4 w-4" />,
        tone: 'danger',
        dividerBefore: true,
        onClick: () => setCancelTarget(sale),
      },
    ]
  }

  const detailBills = detail?.bills ?? []
  const detailProducts = detail?.products ?? []
  const totalItems = useMemo(
    () => detailProducts.reduce((sum, item) => sum + Number(item.amount ?? 0), 0),
    [detailProducts]
  )

  return (
    <div className="flex w-full flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Principal</p>
          <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">Vendas</h1>
          <p className="mt-1 max-w-[760px] text-[13px] text-[var(--ink-soft)]">
            Aqui ficam as vendas do PDV, das mesas, do delivery e as que você lança pelo painel. Para vender no balcão, abra o PDV.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={pdvUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13.5px] font-bold text-[var(--blue-700)] ring-1 ring-[var(--blue-300)] transition hover:bg-[var(--blue-100)]"
          >
            <CoinIcon className="h-4 w-4" />
            Abrir o PDV
          </a>
          <button
            type="button"
            onClick={onCreate}
            className="flex items-center gap-2 rounded-xl bg-[var(--blue-500)] px-4 py-2.5 text-[13.5px] font-bold text-white transition hover:bg-[var(--blue-700)]"
          >
            <PlusIcon className="h-4 w-4" />
            Nova venda
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5">
          <SearchIcon className="h-4 w-4 flex-none text-[var(--muted)]" />
          <input
            type="text"
            placeholder="Buscar por cliente, número ou observação"
            value={search}
            onChange={(event) => {
              setPage(1)
              setSearch(event.target.value)
            }}
            className="w-full bg-transparent text-[13.5px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none"
          />
        </div>
        <div className="w-full sm:w-52">
          <Select
            value={status}
            onChange={(value) => {
              setPage(1)
              setStatus(value)
            }}
          >
            {STATUS_FILTERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
        <label className="flex items-center gap-2 text-[12px] font-semibold text-[var(--ink-soft)]">
          De
          <input
            type="date"
            value={dateStart}
            onChange={(event) => {
              setPage(1)
              setDateStart(event.target.value)
            }}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[13px] text-[var(--ink)] focus:outline-none"
          />
        </label>
        <label className="flex items-center gap-2 text-[12px] font-semibold text-[var(--ink-soft)]">
          até
          <input
            type="date"
            value={dateEnd}
            onChange={(event) => {
              setPage(1)
              setDateEnd(event.target.value)
            }}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[13px] text-[var(--ink)] focus:outline-none"
          />
        </label>
      </div>

      {notice && <p className="rounded-xl bg-[var(--green-100)] px-4 py-3 text-[13px] font-semibold text-[var(--green-600)]">{notice}</p>}
      {error && <div className="rounded-2xl bg-[var(--red-100)] p-4 text-[13.5px] font-medium text-[var(--red-500)]">{error}</div>}

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        {loading ? (
          <div className="flex flex-col gap-2.5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-11 animate-pulse rounded-xl bg-[var(--page)]" />
            ))}
          </div>
        ) : sales.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-[14px] font-semibold text-[var(--ink)]">Nenhuma venda encontrada</p>
            <p className="mt-1 text-[13px] text-[var(--muted)]">
              {search || status || dateStart || dateEnd
                ? 'Tente mudar a busca ou os filtros.'
                : 'As vendas feitas no PDV e as que você lançar aqui aparecem nesta lista.'}
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2.5 sm:hidden">
              {sales.map((sale) => (
                <div key={sale.id} className="rounded-xl border border-[var(--border)] p-3">
                  <button type="button" onClick={() => openDetail(sale)} className="w-full text-left">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px] font-bold text-[var(--ink)]">
                          #{sale.code} · {sale.people?.name ?? 'Consumidor'}
                        </p>
                        <p className="mt-0.5 text-[12px] text-[var(--muted)]">
                          {saleOrigin(sale)} · {formatDate(sale.date_sale)}
                        </p>
                      </div>
                      <span className={`flex-none rounded-full px-2.5 py-1 text-[10.5px] font-bold ${statusTone(sale.status)}`}>
                        {SALE_STATUS_LABELS[sale.status] ?? '—'}
                      </span>
                    </div>
                  </button>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[14px] font-bold text-[var(--ink)]">{formatCurrency(Number(sale.net_total ?? 0))}</span>
                    <RowActionsMenu actions={buildActions(sale)} />
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                    <th className="pb-2.5 pl-3">Nº</th>
                    <th className="pb-2.5">Data</th>
                    <th className="pb-2.5">Cliente</th>
                    <th className="pb-2.5">Origem</th>
                    <th className="pb-2.5 text-right">Total</th>
                    <th className="pb-2.5 pl-4">Situação</th>
                    <th className="pb-2.5 pr-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale, index) => (
                    <tr
                      key={sale.id}
                      onClick={() => openDetail(sale)}
                      className={`cursor-pointer border-b border-[var(--border)] transition-colors last:border-none hover:bg-[var(--blue-100)] ${
                        index % 2 === 1 ? 'bg-[var(--page)]' : ''
                      }`}
                    >
                      <td className="py-2.5 pl-3 font-mono text-[var(--ink-soft)]">#{sale.code}</td>
                      <td className="py-2.5 whitespace-nowrap text-[var(--ink-soft)]">{formatDate(sale.date_sale)}</td>
                      <td className="py-2.5 font-medium text-[var(--ink)]">{sale.people?.name ?? 'Consumidor'}</td>
                      <td className="py-2.5 text-[var(--ink-soft)]">{saleOrigin(sale)}</td>
                      <td className="py-2.5 text-right font-semibold whitespace-nowrap text-[var(--ink)]">
                        {formatCurrency(Number(sale.net_total ?? 0))}
                      </td>
                      <td className="py-2.5 pl-4">
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusTone(sale.status)}`}>
                          {SALE_STATUS_LABELS[sale.status] ?? '—'}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-right" onClick={(event) => event.stopPropagation()}>
                        <RowActionsMenu actions={buildActions(sale)} />
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
            <p className="text-[12px] text-[var(--muted)]">{meta.total} vendas no total</p>
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

      {detail && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[var(--surface)]">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-4 sm:px-6">
            <div>
              <h2 className="text-[15px] font-bold text-[var(--ink)]">Venda #{detail.code}</h2>
              <p className="text-[12px] text-[var(--muted)]">
                {saleOrigin(detail)} · {formatDateTime(detail.created_at ?? detail.date_sale)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {canEdit(detail) && (
                <button
                  type="button"
                  onClick={() => {
                    const target = detail
                    setDetail(null)
                    onEdit(target)
                  }}
                  className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12.5px] font-bold text-[var(--blue-700)] ring-1 ring-[var(--blue-300)] hover:bg-[var(--blue-100)]"
                >
                  <PencilIcon className="h-4 w-4" />
                  Editar
                </button>
              )}
              <button
                type="button"
                onClick={() => setDetail(null)}
                aria-label="Fechar"
                className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--page)] hover:text-[var(--ink)]"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="mx-auto flex w-full min-h-0 max-w-[900px] flex-1 flex-col overflow-y-auto px-4 py-6 sm:px-6">
            {!canEdit(detail) && (
              <p className="mb-4 rounded-xl bg-[var(--blue-100)] px-4 py-3 text-[12.5px] text-[var(--blue-700)]">
                Esta venda já tem pagamento recebido, por isso não pode ser editada. Para corrigir, cancele a venda e lance outra.
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">Cliente</p>
                <p className="mt-0.5 text-[13.5px] font-medium text-[var(--ink)]">{detail.people?.name ?? 'Consumidor'}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">Data</p>
                <p className="mt-0.5 text-[13.5px] font-medium text-[var(--ink)]">{formatDate(detail.date_sale)}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">Situação</p>
                <span className={`mt-1 inline-block rounded-full px-2.5 py-1 text-[11px] font-bold ${statusTone(detail.status)}`}>
                  {SALE_STATUS_LABELS[detail.status] ?? '—'}
                </span>
              </div>
            </div>

            <div className="mt-6">
              <p className="text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                Itens ({loadingDetail ? '…' : totalItems})
              </p>
              {detailProducts.length === 0 ? (
                <p className="mt-2 text-[13px] text-[var(--muted)]">{loadingDetail ? 'Carregando…' : 'Nenhum item registrado.'}</p>
              ) : (
                <div className="mt-2 overflow-x-auto rounded-xl border border-[var(--border)]">
                  <table className="w-full border-collapse text-[13px]">
                    <thead>
                      <tr className="bg-[var(--page)] text-left text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                        <th className="px-3 py-2">Item</th>
                        <th className="px-3 py-2 text-right">Qtd</th>
                        <th className="px-3 py-2 text-right">Valor</th>
                        <th className="px-3 py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailProducts.map((item) => (
                        <tr key={item.id} className="border-t border-[var(--border)]">
                          <td className="px-3 py-2 text-[var(--ink)]">{item.description || item.product?.name || '—'}</td>
                          <td className="px-3 py-2 text-right text-[var(--ink-soft)]">{Number(item.amount ?? 0)}</td>
                          <td className="px-3 py-2 text-right whitespace-nowrap text-[var(--ink-soft)]">
                            {formatCurrency(Number(item.cost_value ?? 0))}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold whitespace-nowrap text-[var(--ink)]">
                            {formatCurrency(Number(item.total ?? item.subtotal ?? 0))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="mt-3 flex flex-col items-end gap-1 text-[13px] text-[var(--ink-soft)]">
                {Number(detail.discount ?? 0) > 0 && (
                  <span>
                    Desconto: {detail.discount_type === 0 ? `${Number(detail.discount)}%` : formatCurrency(Number(detail.discount))}
                  </span>
                )}
                <span className="text-[16px] font-bold text-[var(--ink)]">Total: {formatCurrency(Number(detail.net_total ?? 0))}</span>
              </div>
            </div>

            <div className="mt-6">
              <p className="text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">Pagamento</p>
              {detailBills.length === 0 ? (
                <p className="mt-2 text-[13px] text-[var(--muted)]">
                  {detail.status === 3 ? 'Nenhuma conta a receber gerada.' : 'O pagamento é definido quando o orçamento virar venda.'}
                </p>
              ) : (
                <div className="mt-2 flex flex-col gap-2">
                  {detailBills.map((bill) => (
                    <div key={bill.id} className="flex items-center justify-between gap-3 rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[13px]">
                      <span className="min-w-0">
                        <span className="font-semibold text-[var(--ink)]">
                          {FORM_PAYMENT_LABELS[Number(bill.form_payment)] ?? 'Pagamento'}
                          {bill.installment_number ? ` · parcela ${bill.installment_number}` : ''}
                        </span>
                        <span className="block text-[12px] text-[var(--muted)]">Vence em {formatDate(bill.date_due)}</span>
                      </span>
                      <span className="flex flex-none items-center gap-2">
                        <span className="font-bold text-[var(--ink)]">{formatCurrency(Number(bill.amount ?? 0))}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${
                            Number(bill.status) === 1 ? 'bg-[var(--green-100)] text-[var(--green-600)]' : 'bg-[var(--amber-100)] text-[var(--amber-500)]'
                          }`}
                        >
                          {Number(bill.status) === 1 ? 'Recebido' : 'A receber'}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {detail.note && (
              <div className="mt-6">
                <p className="text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">Observação</p>
                <p className="mt-1 whitespace-pre-line text-[13.5px] text-[var(--ink)]">{detail.note}</p>
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        title="Cancelar esta venda?"
        message={`A venda #${cancelTarget?.code ?? ''} será cancelada e as contas a receber ainda em aberto dela também.${
          saleHasReceivedBill(cancelTarget?.bills) ? ' O que já foi recebido continua lançado no financeiro.' : ''
        } Isso não pode ser desfeito.`}
        confirmLabel="Cancelar venda"
        cancelLabel="Voltar"
        loading={cancelling}
        onConfirm={() => void handleCancel()}
        onCancel={() => setCancelTarget(null)}
      />
    </div>
  )
}
