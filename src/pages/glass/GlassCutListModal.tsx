import { useEffect, useState } from 'react'
import { fetchGlassCutList, fetchGlassProfileList, type GlassCutGroup, type GlassProfilePieceGroup } from '../../lib/glass'
import { ApiError } from '../../lib/api'
import { PrintPreviewModal } from '../../components/PrintPreviewModal'
import { GlassOptimizationModal } from './GlassOptimizationModal'
import { GlassPurchaseModal } from './GlassPurchaseModal'
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
  const [profileGroups, setProfileGroups] = useState<GlassProfilePieceGroup[]>([])
  const [tab, setTab] = useState<'glass' | 'profiles'>('glass')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [printing, setPrinting] = useState(false)
  const [optimizing, setOptimizing] = useState(false)
  const [purchasing, setPurchasing] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setTab('glass')
    Promise.all([
      fetchGlassCutList(session.token.token, company.id, orderIds),
      fetchGlassProfileList(session.token.token, company.id, orderIds),
    ])
      .then(([glass, profiles]) => {
        if (cancelled) return
        setGroups(glass)
        setProfileGroups(profiles)
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
  const profileTotalPieces = profileGroups.reduce((sum, group) => sum + group.total_pieces, 0)
  const profileTotalLength = profileGroups.reduce((sum, group) => sum + group.total_length_m, 0)
  const profilePrintRows = profileGroups.flatMap((group) =>
    group.pieces.map((piece) => ({
      profile: [group.profile, group.color].filter(Boolean).join(' · '),
      length: `${piece.length_mm}`,
      quantity: piece.quantity,
      order: `#${piece.order_code}`,
      client: piece.client,
      item: piece.description,
    }))
  )
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
              {tab === 'glass'
                ? `${totalPieces} peça${totalPieces === 1 ? '' : 's'} · ${number(totalArea)} m² · medidas em mm (largura × altura)`
                : `${profileTotalPieces} peça${profileTotalPieces === 1 ? '' : 's'} · ${number(profileTotalLength)} m de perfil · comprimentos em mm`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPurchasing(true)}
              className="rounded-xl bg-[var(--page)] px-3.5 py-2 text-[12.5px] font-bold text-[var(--blue-700)] hover:bg-[var(--blue-100)]"
            >
              Compras e têmpera
            </button>
            <button
              type="button"
              onClick={() => setOptimizing(true)}
              className="rounded-xl bg-[var(--blue-500)] px-3.5 py-2 text-[12.5px] font-bold text-white hover:bg-[var(--blue-700)]"
            >
              Otimizar corte
            </button>
            <button
              type="button"
              disabled={tab === 'glass' ? !printRows.length : !profilePrintRows.length}
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

        <div className="flex gap-2 border-b border-[var(--border)] px-5 pt-3">
          {(['glass', 'profiles'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`rounded-t-lg px-3.5 py-2 text-[13px] font-bold ${
                tab === key ? 'bg-[var(--page)] text-[var(--ink)]' : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              {key === 'glass' ? 'Vidros' : 'Perfis'}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto p-5">
          {loading ? (
            <div className="h-24 animate-pulse rounded-xl bg-[var(--page)]" />
          ) : error ? (
            <p className="rounded-xl bg-[var(--red-100)] p-4 text-[13px] font-medium text-[var(--red-500)]">{error}</p>
          ) : tab === 'profiles' ? (
            profileGroups.length === 0 ? (
              <p className="py-8 text-center text-[13.5px] text-[var(--muted)]">
                Nenhum perfil nas fórmulas dos modelos deste recorte.
              </p>
            ) : (
              <div className="flex flex-col gap-5">
                {profileGroups.map((group) => (
                  <div key={group.profile_id}>
                    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="text-[14px] font-bold text-[var(--ink)]">
                        {[group.profile, group.color].filter(Boolean).join(' · ')}
                      </h3>
                      <span className="text-[12px] text-[var(--ink-soft)]">
                        {group.total_pieces} peça{group.total_pieces === 1 ? '' : 's'} · {number(group.total_length_m)} m · barra de{' '}
                        {group.bar_length_mm.toLocaleString('pt-BR')} mm
                      </span>
                    </div>
                    <div className="overflow-x-auto rounded-xl bg-[var(--page)] p-2">
                      <table className="w-full border-collapse text-[13px]">
                        <thead>
                          <tr className="text-left text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                            <th className="px-2 pb-1.5">Comprimento (mm)</th>
                            <th className="px-2 pb-1.5 text-right">Qtd</th>
                            <th className="px-2 pb-1.5">Pedido</th>
                            <th className="px-2 pb-1.5">Item</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.pieces.map((piece, index) => (
                            <tr key={`${piece.item_id}-${index}`} className="border-t border-[var(--border)]">
                              <td className="px-2 py-1.5 font-mono font-semibold text-[var(--ink)]">{piece.length_mm}</td>
                              <td className="px-2 py-1.5 text-right font-semibold">{piece.quantity}</td>
                              <td className="px-2 py-1.5 text-[var(--ink-soft)]">
                                #{piece.order_code} {piece.client}
                              </td>
                              <td className="px-2 py-1.5 text-[var(--ink-soft)]">{piece.description}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )
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

      <GlassPurchaseModal open={purchasing} session={session} company={company} orderIds={orderIds} onClose={() => setPurchasing(false)} />
      <GlassOptimizationModal
        open={optimizing}
        session={session}
        company={company}
        orderIds={orderIds}
        title={title}
        onClose={() => setOptimizing(false)}
      />

      <PrintPreviewModal
        open={printing}
        company={company}
        title={tab === 'glass' ? title : `${title} — perfis`}
        subtitle={
          tab === 'glass'
            ? `${totalPieces} peças · ${number(totalArea)} m²`
            : `${profileTotalPieces} peças · ${number(profileTotalLength)} m`
        }
        columns={
          tab === 'glass'
            ? [
                { key: 'glass', label: 'Vidro' },
                { key: 'measures', label: 'Medida (mm)' },
                { key: 'quantity', label: 'Qtd', align: 'right' },
                { key: 'order', label: 'Pedido' },
                { key: 'client', label: 'Cliente' },
                { key: 'item', label: 'Item' },
              ]
            : [
                { key: 'profile', label: 'Perfil' },
                { key: 'length', label: 'Comprimento (mm)' },
                { key: 'quantity', label: 'Qtd', align: 'right' },
                { key: 'order', label: 'Pedido' },
                { key: 'client', label: 'Cliente' },
                { key: 'item', label: 'Item' },
              ]
        }
        rows={tab === 'glass' ? printRows : profilePrintRows}
        onClose={() => setPrinting(false)}
      />
    </div>
  )
}
