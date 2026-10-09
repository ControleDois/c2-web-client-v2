import { useCallback, useEffect, useState } from 'react'
import {
  fetchGlassMaterials,
  fetchGlassTempering,
  printGlassPurchase,
  sendGlassPurchase,
  type GlassCutGroup,
  type GlassPurchaseAccessory,
  type GlassPurchaseBar,
  type GlassPurchaseDocPayload,
} from '../../lib/glass'
import { fetchCompanyWhatsapps, type CompanyWhatsappRecord } from '../../lib/companyWhatsapp'
import { fetchPeople, type PersonRecord } from '../../lib/people'
import { ApiError } from '../../lib/api'
import { formatCurrency } from '../../lib/format'
import { SearchSelectField } from '../../components/form/SearchSelectField'
import { SelectField } from '../../components/form/SelectField'
import { TextField } from '../../components/form/TextField'
import { CloseIcon, PrinterIcon, TagIcon, WhatsappIcon } from '../../components/icons'
import type { AuthCompany, AuthSession } from '../../lib/auth'

interface GlassPurchaseModalProps {
  open: boolean
  session: AuthSession
  company: AuthCompany
  // Sem orderIds, considera todos os itens que ainda não ficaram prontos.
  orderIds?: string[]
  onClose: () => void
}

const SUPPLIER_ROLE = 3
const number = (value: number, digits = 3) => value.toLocaleString('pt-BR', { maximumFractionDigits: digits })

// "Comprar perfis e acessórios" e "Pedido de têmpera": o que comprar, o PDF para
// imprimir e o envio ao fornecedor pelo WhatsApp.
export function GlassPurchaseModal({ open, session, company, orderIds, onClose }: GlassPurchaseModalProps) {
  const token = session.token.token
  const [tab, setTab] = useState<'tempering' | 'materials'>('tempering')
  const [groups, setGroups] = useState<GlassCutGroup[]>([])
  const [bars, setBars] = useState<GlassPurchaseBar[]>([])
  const [accessories, setAccessories] = useState<GlassPurchaseAccessory[]>([])
  const [allGlass, setAllGlass] = useState(false)
  const [kerf, setKerf] = useState('4')
  const [markStage, setMarkStage] = useState(true)
  const [supplier, setSupplier] = useState<PersonRecord | null>(null)
  const [whatsapps, setWhatsapps] = useState<CompanyWhatsappRecord[]>([])
  const [whatsappId, setWhatsappId] = useState('')
  const [notes, setNotes] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<'print' | 'send' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const orderKey = (orderIds ?? []).join(',')

  useEffect(() => {
    if (!open) return
    setTab('tempering')
    setSupplier(null)
    setWhatsappId('')
    setNotes('')
    setMessage('')
    setError(null)
    setNotice(null)
    fetchCompanyWhatsapps(token, company.id, { limit: 100 })
      .then((res) => setWhatsapps((res.data || []).filter((whatsapp) => !whatsapp.official_whatsapp)))
      .catch(() => setWhatsapps([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, token, company.id])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    const timeout = setTimeout(() => {
      Promise.all([
        fetchGlassTempering(token, company.id, { orderIds, allGlass }),
        fetchGlassMaterials(token, company.id, { orderIds, kerf: Number(kerf) || 0 }),
      ])
        .then(([tempering, materials]) => {
          if (cancelled) return
          setGroups(tempering.groups)
          setBars(materials.bars)
          setAccessories(materials.accessories)
        })
        .catch((err) => {
          if (!cancelled) setError(err instanceof ApiError ? err.message : 'Não foi possível montar a lista.')
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, token, company.id, orderKey, allGlass, kerf])

  const searchSuppliers = useCallback(
    (query: string) => fetchPeople(token, company.id, { search: query, limit: 8, role: SUPPLIER_ROLE }).then((res) => res.data),
    [token, company.id]
  )

  if (!open) return null

  const totalPieces = groups.reduce((sum, group) => sum + group.total_pieces, 0)
  const totalArea = groups.reduce((sum, group) => sum + group.total_area_m2, 0)
  const estimatedCost =
    bars.reduce((sum, bar) => sum + bar.estimated_cost, 0) + accessories.reduce((sum, item) => sum + item.estimated_cost, 0)
  const empty = tab === 'tempering' ? groups.length === 0 : bars.length === 0 && accessories.length === 0

  function payload(): GlassPurchaseDocPayload {
    return {
      company_id: company.id,
      type: tab,
      order_ids: orderIds,
      supplier_id: supplier?.id ?? null,
      notes: notes.trim() || undefined,
      kerf: Number(kerf) || 0,
      all_glass: allGlass,
    }
  }

  async function handleSend() {
    if (busy) return
    setError(null)
    setNotice(null)
    if (!supplier) return setError('Escolha o fornecedor que vai receber o pedido.')
    if (!whatsappId) return setError('Selecione o WhatsApp que vai enviar.')
    setBusy('send')
    try {
      const result = await sendGlassPurchase(token, {
        ...payload(),
        whatsappId,
        message: message.trim() || undefined,
        mark_stage: markStage,
      })
      setNotice(
        `Pedido colocado na fila do WhatsApp.${result.moved ? ` ${result.moved} item(ns) passaram para "Têmpera / fornecedor".` : ''}`
      )
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível enviar o pedido.')
    } finally {
      setBusy(null)
    }
  }

  function handlePrint() {
    if (busy) return
    const popup = window.open('', '_blank')
    setError(null)
    setNotice(null)
    setBusy('print')
    printGlassPurchase(token, payload())
      .then(({ url }) => {
        if (popup) popup.location.href = url
        else window.open(url, '_blank')
      })
      .catch((err) => {
        popup?.close()
        setError(err instanceof ApiError ? err.message : 'Não foi possível gerar o PDF.')
      })
      .finally(() => setBusy(null))
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-[860px] flex-col rounded-2xl bg-[var(--surface)] shadow-[var(--card-shadow)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] p-5">
          <div>
            <h2 className="text-[16px] font-bold text-[var(--ink)]">Compras e têmpera</h2>
            <p className="mt-0.5 text-[12.5px] text-[var(--ink-soft)]">
              {tab === 'tempering'
                ? `${totalPieces} peça${totalPieces === 1 ? '' : 's'} · ${number(totalArea)} m² para o fornecedor de vidro`
                : `Perfis e acessórios a comprar · custo estimado ${formatCurrency(estimatedCost)}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--page)] hover:text-[var(--ink)]"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="flex gap-2 border-b border-[var(--border)] px-5 pt-3">
          {(['tempering', 'materials'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`rounded-t-lg px-3.5 py-2 text-[13px] font-bold ${
                tab === key ? 'bg-[var(--page)] text-[var(--ink)]' : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              {key === 'tempering' ? 'Pedido de têmpera' : 'Perfis e acessórios'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading && empty ? (
            <p className="py-8 text-center text-[13px] text-[var(--muted)]">Montando…</p>
          ) : tab === 'tempering' ? (
            <div className="flex flex-col gap-4">
              <label className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={allGlass}
                  onChange={(event) => setAllGlass(event.target.checked)}
                  className="h-4 w-4 accent-[var(--blue-500)]"
                />
                <span className="text-[13px] text-[var(--ink)]">Incluir também vidros que não são temperados</span>
              </label>
              {groups.length === 0 && (
                <p className="py-4 text-center text-[13px] text-[var(--muted)]">
                  Nenhuma peça de vidro temperado nos pedidos. O tipo do vidro é definido em Vidros.
                </p>
              )}
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
                          <th className="px-2 pb-1.5">Largura × altura (mm)</th>
                          <th className="px-2 pb-1.5 text-right">Qtd</th>
                          <th className="px-2 pb-1.5">Pedido</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.pieces.map((piece) => (
                          <tr key={piece.item_id} className="border-t border-[var(--border)]">
                            <td className="px-2 py-1.5 font-semibold">
                              {piece.width_mm} × {piece.height_mm}
                            </td>
                            <td className="px-2 py-1.5 text-right">{piece.quantity}</td>
                            <td className="px-2 py-1.5 text-[var(--ink-soft)]">
                              #{piece.order_code} · {piece.client} · {piece.description}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
              <label className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={markStage}
                  onChange={(event) => setMarkStage(event.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[var(--blue-500)]"
                />
                <span className="text-[13px] text-[var(--ink)]">
                  Ao enviar, passar os itens para a etapa &quot;Têmpera / fornecedor&quot; na produção
                </span>
              </label>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="max-w-[220px]">
                <TextField
                  label="Folga de serra por corte (mm)"
                  icon={<TagIcon className="h-4 w-4" />}
                  inputMode="numeric"
                  value={kerf}
                  onChange={(event) => setKerf(event.target.value.replace(/\D/g, ''))}
                />
              </div>
              {bars.length === 0 && accessories.length === 0 && (
                <p className="py-4 text-center text-[13px] text-[var(--muted)]">
                  Nenhum perfil ou acessório a comprar. Configure perfis e acessórios nas linhas do modelo.
                </p>
              )}
              {bars.length > 0 && (
                <div>
                  <h3 className="mb-2 text-[14px] font-bold text-[var(--ink)]">Perfis</h3>
                  <div className="overflow-x-auto rounded-xl bg-[var(--page)] p-2">
                    <table className="w-full border-collapse text-[13px]">
                      <thead>
                        <tr className="text-left text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                          <th className="px-2 pb-1.5">Perfil</th>
                          <th className="px-2 pb-1.5">Cor</th>
                          <th className="px-2 pb-1.5 text-right">Barra (mm)</th>
                          <th className="px-2 pb-1.5 text-right">Barras</th>
                          <th className="px-2 pb-1.5 text-right">Custo est.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bars.map((bar) => (
                          <tr key={bar.profile_id} className="border-t border-[var(--border)]">
                            <td className="px-2 py-1.5">{bar.profile}</td>
                            <td className="px-2 py-1.5 text-[var(--ink-soft)]">{bar.color}</td>
                            <td className="px-2 py-1.5 text-right">{bar.bar_length_mm.toLocaleString('pt-BR')}</td>
                            <td className="px-2 py-1.5 text-right font-semibold">{bar.total_bars}</td>
                            <td className="px-2 py-1.5 text-right">{formatCurrency(bar.estimated_cost)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {accessories.length > 0 && (
                <div>
                  <h3 className="mb-2 text-[14px] font-bold text-[var(--ink)]">Acessórios</h3>
                  <div className="overflow-x-auto rounded-xl bg-[var(--page)] p-2">
                    <table className="w-full border-collapse text-[13px]">
                      <thead>
                        <tr className="text-left text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                          <th className="px-2 pb-1.5">Acessório</th>
                          <th className="px-2 pb-1.5">Un.</th>
                          <th className="px-2 pb-1.5 text-right">Quantidade</th>
                          <th className="px-2 pb-1.5 text-right">Custo est.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {accessories.map((item) => (
                          <tr key={item.accessory_id} className="border-t border-[var(--border)]">
                            <td className="px-2 py-1.5">
                              {item.name}
                              {item.reference && <span className="ml-1.5 text-[11.5px] text-[var(--muted)]">{item.reference}</span>}
                            </td>
                            <td className="px-2 py-1.5">{item.unit}</td>
                            <td className="px-2 py-1.5 text-right font-semibold">{number(item.quantity)}</td>
                            <td className="px-2 py-1.5 text-right">{formatCurrency(item.estimated_cost)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              <p className="text-[11.5px] text-[var(--muted)]">
                O custo estimado é só para você: o PDF enviado ao fornecedor não mostra valores. As barras consideram o plano de corte com a folga de serra informada.
              </p>
            </div>
          )}

          <div className="mt-5 grid gap-4 border-t border-[var(--border)] pt-4 sm:grid-cols-2">
            <SearchSelectField
              label="Fornecedor"
              placeholder="Buscar fornecedor"
              selectedLabel={supplier?.name ?? null}
              selectedSubLabel={supplier?.phone ?? undefined}
              onSearch={searchSuppliers}
              getOptionLabel={(item: PersonRecord) => item.name}
              getOptionSubLabel={(item: PersonRecord) => item.phone ?? undefined}
              onSelect={(item: PersonRecord) => setSupplier(item)}
              onClear={() => setSupplier(null)}
              variant="surface"
            />
            <SelectField label="WhatsApp para envio" variant="surface" value={whatsappId} onChange={(event) => setWhatsappId(event.target.value)}>
              <option value="">Selecione</option>
              {whatsapps.map((whatsapp) => (
                <option key={whatsapp.id} value={whatsapp.id}>
                  {whatsapp.name} - {whatsapp.phone}
                </option>
              ))}
            </SelectField>
            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Observações no pedido (aparecem no PDF)</span>
              <textarea
                rows={2}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Prazo, forma de entrega…"
                className="resize-y rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[13.5px] text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--blue-300)]"
              />
            </label>
            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Mensagem do WhatsApp (opcional)</span>
              <textarea
                rows={2}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Em branco, vai uma mensagem padrão com o nome do fornecedor."
                className="resize-y rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[13.5px] text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--blue-300)]"
              />
            </label>
          </div>

          {error && <p className="mt-3 rounded-xl bg-[var(--red-100)] px-4 py-2.5 text-[13px] font-medium text-[var(--red-500)]">{error}</p>}
          {notice && <p className="mt-3 rounded-xl bg-[var(--blue-100)] px-4 py-2.5 text-[13px] font-medium text-[var(--blue-700)]">{notice}</p>}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[var(--border)] p-4">
          <button
            type="button"
            onClick={handleSend}
            disabled={busy !== null || empty}
            className="flex items-center gap-2 rounded-xl bg-[var(--page)] px-5 py-2.5 text-[14px] font-bold text-[var(--blue-700)] transition hover:bg-[var(--blue-100)] disabled:opacity-60"
          >
            <WhatsappIcon className="h-4 w-4" />
            {busy === 'send' ? 'Enviando…' : 'Enviar ao fornecedor'}
          </button>
          <button
            type="button"
            onClick={handlePrint}
            disabled={busy !== null || empty}
            className="flex items-center gap-2 rounded-xl bg-[var(--blue-500)] px-6 py-2.5 text-[14px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:opacity-60"
          >
            <PrinterIcon className="h-4 w-4" />
            {busy === 'print' ? 'Gerando…' : 'Visualizar / imprimir'}
          </button>
        </div>
      </div>
    </div>
  )
}
