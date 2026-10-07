import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  changeGlassItemStage,
  fetchGlassProduction,
  GLASS_STAGE_LABELS,
  type GlassProductionItem,
} from '../../lib/glass'
import { ApiError } from '../../lib/api'
import { formatDate } from '../../lib/format'
import { SelectField } from '../../components/form/SelectField'
import { GlassCutListModal } from './GlassCutListModal'
import { GlassStatusBadge } from './GlassOrdersPage'
import { SearchIcon, ClipboardCheckIcon } from '../../components/icons'
import type { AuthCompany, AuthSession } from '../../lib/auth'

interface GlassProductionPageProps {
  session: AuthSession
  company: AuthCompany
}

const STAGE_TONES: Record<number, string> = {
  0: 'bg-[var(--page)] text-[var(--ink-soft)]',
  1: 'bg-[var(--amber-100)] text-[var(--amber-500)]',
  2: 'bg-[var(--amber-100)] text-[var(--amber-500)]',
  3: 'bg-[var(--blue-100)] text-[var(--blue-700)]',
  4: 'bg-[var(--green-100)] text-[var(--green-600)]',
}

export function GlassProductionPage({ session, company }: GlassProductionPageProps) {
  const token = session.token.token
  const [items, setItems] = useState<GlassProductionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [stage, setStage] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkStage, setBulkStage] = useState('1')
  const [saving, setSaving] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [cutList, setCutList] = useState<{ orderIds?: string[]; title: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    const timeout = setTimeout(() => {
      fetchGlassProduction(token, company.id, { search, stage })
        .then((res) => {
          if (cancelled) return
          setItems(res)
          setSelected(new Set())
        })
        .catch((err) => {
          if (!cancelled) setError(err instanceof ApiError ? err.message : 'Não foi possível carregar a produção.')
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [token, company.id, search, stage, reloadKey])

  const orders = useMemo(() => {
    const map = new Map<string, { order: GlassProductionItem['order']; items: GlassProductionItem[] }>()
    for (const item of items) {
      if (!map.has(item.glass_order_id)) map.set(item.glass_order_id, { order: item.order, items: [] })
      map.get(item.glass_order_id)?.items.push(item)
    }
    return [...map.values()]
  }, [items])

  const applyStage = useCallback(
    async (ids: string[], nextStage: number) => {
      if (!ids.length) return
      setSaving(true)
      setError(null)
      try {
        await changeGlassItemStage(token, ids, nextStage)
        setReloadKey((key) => key + 1)
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Não foi possível atualizar o estágio.')
      } finally {
        setSaving(false)
      }
    },
    [token]
  )

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleOrder(orderItems: GlassProductionItem[]) {
    setSelected((current) => {
      const next = new Set(current)
      const allSelected = orderItems.every((item) => next.has(item.id))
      orderItems.forEach((item) => (allSelected ? next.delete(item.id) : next.add(item.id)))
      return next
    })
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Vidraçaria</p>
          <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">Produção</h1>
        </div>
        <button
          type="button"
          onClick={() => setCutList({ title: 'Lista de corte — itens pendentes' })}
          className="flex items-center gap-2 rounded-xl bg-[var(--blue-500)] px-4 py-2.5 text-[13.5px] font-bold text-white transition hover:bg-[var(--blue-700)]"
        >
          <ClipboardCheckIcon className="h-4 w-4" />
          Lista de corte geral
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5">
          <SearchIcon className="h-4 w-4 flex-none text-[var(--muted)]" />
          <input
            type="text"
            placeholder="Buscar por cliente, pedido, obra ou item"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full bg-transparent text-[13.5px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none"
          />
        </div>
        <div className="min-w-[200px]">
          <SelectField label="" variant="surface" value={stage} onChange={(event) => setStage(event.target.value)}>
            <option value="">Todos os estágios</option>
            {Object.entries(GLASS_STAGE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectField>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[var(--blue-100)] px-4 py-3">
          <span className="text-[13px] font-bold text-[var(--blue-700)]">
            {selected.size} peça{selected.size === 1 ? '' : 's'} selecionada{selected.size === 1 ? '' : 's'}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-52">
              <SelectField label="" variant="surface" value={bulkStage} onChange={(event) => setBulkStage(event.target.value)}>
                {Object.entries(GLASS_STAGE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    Mover para: {label}
                  </option>
                ))}
              </SelectField>
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={() => applyStage([...selected], Number(bulkStage))}
              className="rounded-xl bg-[var(--blue-500)] px-4 py-2 text-[12.5px] font-bold text-white hover:bg-[var(--blue-700)] disabled:opacity-60"
            >
              {saving ? 'Salvando…' : 'Aplicar'}
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="rounded-xl px-3.5 py-2 text-[12.5px] font-semibold text-[var(--blue-700)] hover:underline"
            >
              Limpar
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-2xl bg-[var(--red-100)] p-4 text-[13.5px] font-medium text-[var(--red-500)]">{error}</div>
      )}

      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-2xl bg-[var(--surface)]" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <p className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] py-10 text-center text-[13.5px] text-[var(--muted)]">
          Nenhum item em produção. Os pedidos aparecem aqui depois de aprovados como venda.
        </p>
      ) : (
        orders.map(({ order, items: orderItems }) => (
          <div key={order.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="checkbox"
                  checked={orderItems.every((item) => selected.has(item.id))}
                  onChange={() => toggleOrder(orderItems)}
                  className="h-4 w-4 accent-[var(--blue-500)]"
                  aria-label={`Selecionar itens do pedido ${order.code}`}
                />
                <div>
                  <p className="text-[14px] font-bold text-[var(--ink)]">
                    #{order.code} · {order.people?.name ?? 'Sem cliente'}
                  </p>
                  <p className="text-[12px] text-[var(--muted)]">
                    {[order.reference, order.expected_delivery ? `Entrega: ${formatDate(order.expected_delivery)}` : null]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </p>
                </div>
                <GlassStatusBadge status={order.status} />
              </div>
              <button
                type="button"
                onClick={() => setCutList({ orderIds: [order.id], title: `Lista de corte — pedido #${order.code}` })}
                className="rounded-xl border border-[var(--border)] px-3.5 py-2 text-[12.5px] font-bold text-[var(--ink-soft)] hover:text-[var(--ink)]"
              >
                Lista de corte
              </button>
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                    <th className="w-8 pb-2" />
                    <th className="pb-2">Item</th>
                    <th className="pb-2">Vidro</th>
                    <th className="pb-2">Vão (mm)</th>
                    <th className="pb-2">Peça de vidro (mm)</th>
                    <th className="pb-2 text-right">Qtd</th>
                    <th className="pb-2 pl-3">Estágio</th>
                  </tr>
                </thead>
                <tbody>
                  {orderItems.map((item) => (
                    <tr key={item.id} className="border-b border-[var(--border)] last:border-none">
                      <td className="py-2">
                        <input
                          type="checkbox"
                          checked={selected.has(item.id)}
                          onChange={() => toggle(item.id)}
                          className="h-4 w-4 accent-[var(--blue-500)]"
                          aria-label={`Selecionar ${item.description}`}
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <p className="font-medium text-[var(--ink)]">{item.description}</p>
                        {item.location && <p className="text-[11.5px] text-[var(--muted)]">{item.location}</p>}
                      </td>
                      <td className="py-2 pr-3 text-[var(--ink-soft)]">{item.glassType?.name ?? '—'}</td>
                      <td className="py-2 pr-3 whitespace-nowrap text-[var(--ink-soft)]">
                        {item.width_mm} × {item.height_mm}
                      </td>
                      <td className="py-2 pr-3 font-mono font-semibold whitespace-nowrap text-[var(--ink)]">
                        {item.piece.width_mm} × {item.piece.height_mm}
                        <span className="ml-1 font-sans text-[11.5px] font-normal text-[var(--muted)]">
                          ({item.piece.quantity} pç)
                        </span>
                      </td>
                      <td className="py-2 text-right">{item.quantity}</td>
                      <td className="py-2 pl-3">
                        <select
                          value={item.production_stage}
                          disabled={saving}
                          onChange={(event) => applyStage([item.id], Number(event.target.value))}
                          className={`rounded-full px-2.5 py-1 text-[12px] font-bold focus:outline-none ${
                            STAGE_TONES[item.production_stage] ?? STAGE_TONES[0]
                          }`}
                        >
                          {Object.entries(GLASS_STAGE_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}

      <GlassCutListModal
        open={Boolean(cutList)}
        session={session}
        company={company}
        orderIds={cutList?.orderIds}
        title={cutList?.title}
        onClose={() => setCutList(null)}
      />
    </div>
  )
}
