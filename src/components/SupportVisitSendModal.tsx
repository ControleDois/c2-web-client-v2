import { useEffect, useState } from 'react'
import { sendSupportVisitReport, type SupportVisitRecord } from '../lib/supportVisits'
import { fetchCompanyWhatsapps, type CompanyWhatsappRecord } from '../lib/companyWhatsapp'
import { formatPhone } from '../lib/formatPhone'
import { ApiError } from '../lib/api'
import { Select } from './form/Select'
import { CloseIcon, WhatsappIcon } from './icons'
import type { AuthCompany, AuthSession } from '../lib/auth'

interface SupportVisitSendModalProps {
  open: boolean
  session: AuthSession
  company: AuthCompany
  visit: SupportVisitRecord | null
  onClose: () => void
  onSent: (message: string) => void
}

// Envia o relatório da visita (PDF com o que foi feito, as fotos e as assinaturas) para o WhatsApp do cliente.
export function SupportVisitSendModal({ open, session, company, visit, onClose, onSent }: SupportVisitSendModalProps) {
  const [whatsapps, setWhatsapps] = useState<CompanyWhatsappRecord[]>([])
  const [whatsappId, setWhatsappId] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setWhatsappId('')
    setError(null)
    setLoading(true)
    fetchCompanyWhatsapps(session.token.token, company.id, { limit: 100 })
      .then((res) => {
        const usable = (res.data || []).filter((whatsapp) => !whatsapp.official_whatsapp)
        setWhatsapps(usable)
        if (usable.length === 1) setWhatsappId(usable[0].id)
      })
      .catch(() => setWhatsapps([]))
      .finally(() => setLoading(false))
  }, [open, session.token.token, company.id])

  if (!open || !visit) return null

  const phone = String(visit.people?.phone || '').replace(/\D/g, '')

  async function handleSend() {
    if (!visit) return
    if (!whatsappId) {
      setError('Escolha o WhatsApp que vai enviar o relatório.')
      return
    }
    setSending(true)
    setError(null)
    try {
      const result = await sendSupportVisitReport(session.token.token, visit.id, whatsappId)
      onSent(result.message)
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível enviar o relatório.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onClick={sending ? undefined : onClose}>
      <div
        className="w-full max-w-[460px] rounded-2xl bg-[var(--surface)] p-6 shadow-[var(--card-shadow)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[15px] font-bold text-[var(--ink)]">Enviar a visita ao cliente</h2>
            <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--ink-soft)]">
              O cliente recebe no WhatsApp o relatório em PDF, com o que foi feito, as fotos e as assinaturas.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            aria-label="Fechar"
            className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--page)] disabled:opacity-60"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 rounded-xl bg-[var(--page)] px-4 py-3">
          <p className="text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">Cliente</p>
          <p className="mt-0.5 text-[13.5px] font-semibold text-[var(--ink)]">{visit.people?.name ?? '—'}</p>
          {phone ? (
            <p className="text-[12.5px] text-[var(--ink-soft)]">WhatsApp: {formatPhone(phone)}</p>
          ) : (
            <p className="mt-1 text-[12.5px] font-medium text-[var(--red-500)]">
              Este cliente não tem WhatsApp cadastrado. Informe o telefone dele em Pessoas e tente de novo.
            </p>
          )}
        </div>

        <div className="mt-4">
          <p className="mb-1.5 text-[12px] font-semibold text-[var(--ink-soft)]">Enviar por qual WhatsApp?</p>
          {loading ? (
            <div className="h-11 animate-pulse rounded-xl bg-[var(--page)]" />
          ) : whatsapps.length === 0 ? (
            <p className="rounded-xl bg-[var(--amber-100)] px-4 py-3 text-[12.5px] text-[var(--ink)]">
              Nenhum WhatsApp conectado. Conecte um em Configurações → WhatsApp para poder enviar.
            </p>
          ) : (
            <Select value={whatsappId} onChange={setWhatsappId}>
              <option value="">Selecione</option>
              {whatsapps.map((whatsapp) => (
                <option key={whatsapp.id} value={whatsapp.id}>
                  {whatsapp.name} - {whatsapp.phone}
                </option>
              ))}
            </Select>
          )}
        </div>

        {error && <p className="mt-3 text-[13px] font-medium text-[var(--red-500)]">{error}</p>}

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="h-11 flex-1 rounded-xl border border-[var(--border)] text-[13px] font-bold text-[var(--ink-soft)] disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={sending || !phone || whatsapps.length === 0}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--green-600)] text-[13px] font-bold text-white hover:opacity-90 disabled:opacity-50"
          >
            <WhatsappIcon className="h-4 w-4" />
            {sending ? 'Gerando e enviando…' : 'Enviar relatório'}
          </button>
        </div>
      </div>
    </div>
  )
}
