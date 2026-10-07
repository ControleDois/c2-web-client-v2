import { useEffect, useState } from 'react'
import { fetchGlassCutList, type GlassCutGroup } from '../../lib/glass'
import { ApiError } from '../../lib/api'
import { PrintPreviewModal } from '../../components/PrintPreviewModal'
import { CloseIcon, PrinterIcon } from '../../components/icons'
import type { AuthCompany, AuthSession } from '../../lib/auth'

interface GlassCutListModalProps {
  open: boolean
  session: AuthSession
  company: AuthCompany
  // Sem orderIds, mostra todos os itens que ainda não ficaram prontos.
  orderIds?: string[]
  title?: string
  onClose: () => void
}

const number = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 3 })

export function GlassCutListModal({ open, session, company, orderIds, title = 'Lista de corte', onClose }: GlassCutListModalProps) {
  const [groups, setGroups] = useState<GlassCutGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [printing, setPrinting] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchGlassCutList(session.token.token, company.id, orderIds)
      .then((res) => {
        if (!cancelled) setGroups(res)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Não foi possível montar a lista de corte.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, session.token.token, company.id, (orderIds ?? []).join(',')])

  if (!open) return null

  const totalPieces = groups.reduce((sum, group) => sum + group.total_pieces, 0)
  const totalArea = groups.reduce((sum, group) => sum + group.total_area_m2, 0)
  const printRows = groups.flatMap((group) =>
    group.pieces.map((piece) => ({
      glass: group.glass_type,
      order: `#${piece.order_code}`,
      client: piece.client,
      item: [piece.description, piece.location].filter(Boolean).join(' · '),
      measures: `${piece.width_mm} × ${piece.height_mm}`,
      quantity: piece.quantity,
    }))
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-[860px] flex-col rounded-2xl bg-[var(--surface)] shadow-[var(--card-shadow)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] p-5">
          <div>
            <h2 className="text-[16px] font-bold text-[var(--ink)]">{title}</h2>
            <p className="mt-0.5 text-[12.5px] text-[var(--ink-soft)]">
              {totalPieces} peça{totalPieces === 1 ? '' : 's'} · {number(totalArea)} m² · medidas em mm (largura × altura)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!printRows.length}
              onClick={() => setPrinting(true)}
              className="flex items-center gap-1.5 rounded-xl bg-[var(--page)] px-3.5 py-2 text-[12.5px] font-bold text-[var(--blue-700)] hover:bg-[var(--blue-100)] disabled:opacity-50"
            >
              <PrinterIcon className="h-3.5 w-3.5" />
              Imprimir
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--page)] hover:text-[var(--ink)]"
              aria-label="Fechar"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-5">
          {loading ? (
            <div className="h-24 animate-pulse rounded-xl bg-[var(--page)]" />
          ) : error ? (
            <p className="rounded-xl bg-[var(--red-100)] p-4 text-[13px] font-medium text-[var(--red-500)]">{error}</p>
          ) : groups.length === 0 ? (
            <p className="py-8 text-center text-[13.5px] text-[var(--muted)]">Nenhuma peça para cortar.</p>
          ) : (
            <div className="flex flex-col gap-5">
              {groups.map((group) => (
                <div key={group.glass_type_id ?? 'none'}>
                  <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-[14px] font-bold text-[var(--ink)]">{group.glass_type}</h3>
                    <span className="text-[12px] text-[var(--ink-soft)]">
                      {group.total_pieces} peça{group.total_pieces === 1 ? '' : 's'} · {number(group.total_area_m2)} m²
                    </span>
                  </div>
                  <div className="overflow-x-auto rounded-xl bg-[var(--page)] p-2">
                    <table className="w-full border-collapse text-[13px]">
                      <thead>
                        <tr className="text-left text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                          <th className="px-2 pb-1.5">Medida (mm)</th>
                          <th className="px-2 pb-1.5 text-right">Qtd</th>
                          <th className="px-2 pb-1.5">Pedido</th>
                          <th className="px-2 pb-1.5">Item</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.pieces.map((piece) => (
                          <tr key={`${piece.item_id}`} className="border-t border-[var(--border)]">
                            <td className="px-2 py-1.5 font-mono font-semibold text-[var(--ink)]">
                              {piece.width_mm} × {piece.height_mm}
                            </td>
                            <td className="px-2 py-1.5 text-right font-semibold">{piece.quantity}</td>
                            <td className="px-2 py-1.5 text-[var(--ink-soft)]">
                              #{piece.order_code} {piece.client}
                            </td>
                            <td className="px-2 py-1.5 text-[var(--ink-soft)]">
                              {[piece.description, piece.location].filter(Boolean).join(' · ')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <PrintPreviewModal
        open={printing}
        company={company}
        title={title}
        subtitle={`${totalPieces} peças · ${number(totalArea)} m²`}
        columns={[
          { key: 'glass', label: 'Vidro' },
          { key: 'measures', label: 'Medida (mm)' },
          { key: 'quantity', label: 'Qtd', align: 'right' },
          { key: 'order', label: 'Pedido' },
          { key: 'client', label: 'Cliente' },
          { key: 'item', label: 'Item' },
        ]}
        rows={printRows}
        onClose={() => setPrinting(false)}
      />
    </div>
  )
}
