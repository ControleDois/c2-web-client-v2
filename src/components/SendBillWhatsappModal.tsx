import { useEffect, useState } from 'react'
import { sendBillWhatsapp, type BillRecord } from '../lib/bills'
import { fetchCompanyWhatsapps, type CompanyWhatsappRecord } from '../lib/companyWhatsapp'
import { formatCurrency } from '../lib/format'
import { ApiError } from '../lib/api'
import { CloseIcon, WhatsappIcon } from './icons'
import { SelectField } from './form/SelectField'
import type { AuthSession, AuthCompany } from '../lib/auth'

interface SendBillWhatsappModalProps {
  open: boolean
  session: AuthSession
  company: AuthCompany
  bill: BillRecord | null
  onClose: () => void
  onSent: (message: string) => void
}

export function SendBillWhatsappModal({ open, session, company, bill, onClose, onSent }: SendBillWhatsappModalProps) {
  const [whatsapps, setWhatsapps] = useState<CompanyWhatsappRecord[]>([])
  const [whatsappId, setWhatsappId] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !bill) return
    setWhatsappId('')
    setError(null)

    fetchCompanyWhatsapps(session.token.token, company.id, { limit: 100 })
      .then((res) => {
        setWhatsapps((res.data || []).filter((whatsapp) => !whatsapp.official_whatsapp))
      })
      .catch(() => setWhatsapps([]))
  }, [open, bill, session.token.token, company.id])

  if (!open || !bill) return null

  async function handleSend() {
    if (!bill) return
    if (!whatsappId) {
      setError('Selecione o WhatsApp que enviará a cobrança.')
      return
    }

    setSending(true)
    setError(null)
    try {
      await sendBillWhatsapp(session.token.token, bill.id, whatsappId)
      onSent('A cobrança foi colocada na fila do WhatsApp.')
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível enviar a cobrança.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={sending ? undefined : onClose}>
      <div
        className="w-full max-w-[440px] rounded-2xl bg-[var(--surface)] p-6 shadow-[var(--card-shadow)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[15px] font-bold text-[var(--ink)]">Enviar cobrança por WhatsApp</h2>
            <p className="mt-1 text-[12.5px] text-[var(--ink-soft)]">
              {bill.name} · {formatCurrency(bill.amount)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--page)] hover:text-[var(--ink)] disabled:opacity-60"
            aria-label="Fechar"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-1.5">
          <SelectField label="WhatsApp" value={whatsappId} onChange={(event) => setWhatsappId(event.target.value)}>
            <option value="">Selecione</option>
            {whatsapps.map((whatsapp) => (
              <option key={whatsapp.id} value={whatsapp.id}>
                {whatsapp.name} - {whatsapp.phone}
              </option>
            ))}
          </SelectField>
          <p className="text-[11.5px] text-[var(--muted)]">
            O tipo de cobrança (boleto, PIX ou mensagem simples) é resolvido automaticamente com base no que já
            foi gerado para essa conta.
          </p>
        </div>

        {error && <p className="mt-3 text-[13px] font-medium text-[var(--red-500)]">{error}</p>}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="rounded-xl px-4 py-2 text-[13.5px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)] disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={sending}
            className="flex items-center gap-2 rounded-xl bg-[var(--blue-500)] px-4 py-2 text-[13.5px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:opacity-60"
          >
            <WhatsappIcon className="h-4 w-4" />
            {sending ? 'Enviando…' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  )
}
