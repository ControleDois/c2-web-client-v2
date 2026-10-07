import { useEffect, useState } from 'react'
import { generateGlassOrderNfe, type GlassOrderRecord } from '../../lib/glass'
import { extractPendencies, type Pendencies } from '../../lib/pendencies'
import { ApiError } from '../../lib/api'
import { FiscalProductField } from '../../components/form/FiscalProductField'
import { PendenciesDialog } from '../../components/PendenciesDialog'
import { CloseIcon } from '../../components/icons'
import type { AuthCompany, AuthSession } from '../../lib/auth'

interface GlassInvoiceModalProps {
  open: boolean
  session: AuthSession
  company: AuthCompany
  order: Pick<GlassOrderRecord, 'id' | 'code'> | null
  onClose: () => void
  onDone: (message: string) => void
}

const STORAGE_KEY = 'glass-default-fiscal-product'

function readSavedProduct(companyId: string): { id: string; name: string } | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}:${companyId}`)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function GlassInvoiceModal({ open, session, company, order, onClose, onDone }: GlassInvoiceModalProps) {
  const [product, setProduct] = useState<{ id: string; name: string } | null>(null)
  const [sendNow, setSendNow] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendencies, setPendencies] = useState<Pendencies | null>(null)

  useEffect(() => {
    if (!open) return
    setProduct(readSavedProduct(company.id))
    setSendNow(false)
    setError(null)
  }, [open, company.id])

  if (!open || !order) return null

  async function handleGenerate() {
    if (!order) return
    setSaving(true)
    setError(null)
    try {
      const result = await generateGlassOrderNfe(session.token.token, order.id, {
        product_id: product?.id ?? null,
        send: sendNow,
      })
      try {
        if (product) localStorage.setItem(`${STORAGE_KEY}:${company.id}`, JSON.stringify(product))
      } catch {
        // sem armazenamento local: só não lembra o produto da próxima vez
      }
      onDone(result.mensagem)
      onClose()
    } catch (err) {
      const found = extractPendencies(err)
      if (found) setPendencies(found)
      else setError(err instanceof ApiError ? err.message : 'Não foi possível gerar a NF-e.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={saving ? undefined : onClose}>
      <div
        className="w-full max-w-[520px] rounded-2xl bg-[var(--surface)] p-6 shadow-[var(--card-shadow)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[16px] font-bold text-[var(--ink)]">Emitir NF-e do pedido #{order.code}</h2>
            <p className="mt-1 text-[12.5px] text-[var(--ink-soft)]">
              Cada item do pedido vira uma linha da nota. O NCM e a tributação vêm do produto fiscal do modelo ou do vidro;
              se o item não tiver, vale o produto padrão abaixo.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Fechar"
            className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--page)] hover:text-[var(--ink)]"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4">
          <FiscalProductField
            session={session}
            company={company}
            variant="surface"
            label="Produto fiscal padrão"
            value={product}
            onChange={setProduct}
          />
        </div>

        <label className="mt-4 flex items-start gap-2.5">
          <input
            type="checkbox"
            checked={sendNow}
            onChange={(event) => setSendNow(event.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[var(--blue-500)]"
          />
          <span>
            <span className="block text-[13.5px] font-semibold text-[var(--ink)]">Enviar para a SEFAZ agora</span>
            <span className="block text-[12px] text-[var(--ink-soft)]">
              Desmarcado, cria só o rascunho em Notas Fiscais para você conferir e enviar depois.
            </span>
          </span>
        </label>

        {error && <p className="mt-3 rounded-xl bg-[var(--red-100)] px-4 py-2.5 text-[13px] font-medium text-[var(--red-500)]">{error}</p>}

        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-xl px-4 py-2.5 text-[14px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]">
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={saving}
            className="rounded-xl bg-[var(--blue-500)] px-6 py-2.5 text-[14px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:opacity-60"
          >
            {saving ? 'Gerando…' : sendNow ? 'Gerar e enviar' : 'Gerar rascunho'}
          </button>
        </div>
      </div>
      <PendenciesDialog pendencies={pendencies} onClose={() => setPendencies(null)} />
    </div>
  )
}
