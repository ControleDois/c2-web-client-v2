import { useEffect, useState } from 'react'
import { fetchBillWhatsappPreview, sendBillWhatsapp, type BillRecord } from '../lib/bills'
import { fetchCompanyWhatsapps, type CompanyWhatsappRecord } from '../lib/companyWhatsapp'
import { formatCurrency } from '../lib/format'
import { ApiError } from '../lib/api'
import { CloseIcon, CopyIcon, QrCodeIcon, FileTextIcon, WhatsappIcon } from './icons'
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

// Código/linha copiado ao clicar, com feedback "Copiado!" temporário -
// mesmo padrão usado na tela de listagem para copiar o PIX direto.
function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // silencioso - o botão continua clicável pra tentar de novo
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--page)] px-3 py-2">
      <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-[var(--ink-soft)]" title={value}>
        {value}
      </span>
      <button
        type="button"
        onClick={handleCopy}
        className={`flex flex-none items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11.5px] font-bold transition ${
          copied
            ? 'bg-[var(--green-100)] text-[var(--green-600)]'
            : 'bg-[var(--blue-100)] text-[var(--blue-700)] hover:bg-[var(--blue-300)]'
        }`}
      >
        <CopyIcon className="h-3.5 w-3.5" />
        {copied ? 'Copiado!' : `Copiar ${label}`}
      </button>
    </div>
  )
}

export function SendBillWhatsappModal({ open, session, company, bill, onClose, onSent }: SendBillWhatsappModalProps) {
  const [whatsapps, setWhatsapps] = useState<CompanyWhatsappRecord[]>([])
  const [whatsappId, setWhatsappId] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [previewMessage, setPreviewMessage] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)

  const hasPix = Boolean(bill?.pix_copia_e_cola)
  const hasBoleto = Boolean(bill?.boleto_linha_digital)

  const [sendMessage, setSendMessage] = useState(true)
  const [sendPixButton, setSendPixButton] = useState(false)
  const [sendBoleto, setSendBoleto] = useState(false)

  useEffect(() => {
    if (!open || !bill) return
    setWhatsappId('')
    setError(null)
    setSendMessage(true)
    setSendPixButton(hasPix)
    setSendBoleto(false)
    setPreviewMessage('')
    setPreviewLoading(true)

    fetchCompanyWhatsapps(session.token.token, company.id, { limit: 100 })
      .then((res) => {
        setWhatsapps((res.data || []).filter((whatsapp) => !whatsapp.official_whatsapp))
      })
      .catch(() => setWhatsapps([]))

    fetchBillWhatsappPreview(session.token.token, bill.id)
      .then((res) => setPreviewMessage(res.message))
      .catch(() => setPreviewMessage(''))
      .finally(() => setPreviewLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, bill?.id, session.token.token, company.id])

  if (!open || !bill) return null

  const nothingSelected = !sendMessage && !sendPixButton && !sendBoleto

  async function handleSend() {
    if (!bill) return
    if (!whatsappId) {
      setError('Selecione o WhatsApp que enviará a cobrança.')
      return
    }
    if (nothingSelected) {
      setError('Selecione ao menos uma opção de envio.')
      return
    }

    setSending(true)
    setError(null)
    try {
      await sendBillWhatsapp(session.token.token, bill.id, whatsappId, {
        sendMessage,
        sendPixButton,
        sendBoleto,
      })
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
        className="flex max-h-[90vh] w-full max-w-[480px] flex-col overflow-hidden rounded-2xl bg-[var(--surface)] shadow-[var(--card-shadow)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 p-6 pb-4">
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

        <div className="flex-1 overflow-y-auto px-6">
          <SelectField label="WhatsApp" value={whatsappId} onChange={(event) => setWhatsappId(event.target.value)}>
            <option value="">Selecione</option>
            {whatsapps.map((whatsapp) => (
              <option key={whatsapp.id} value={whatsapp.id}>
                {whatsapp.name} - {whatsapp.phone}
              </option>
            ))}
          </SelectField>

          <div className="mt-4 flex flex-col gap-2.5">
            <p className="text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">O que enviar</p>

            <label className="flex items-start gap-2.5 rounded-xl border border-[var(--border)] p-3">
              <input
                type="checkbox"
                checked={sendMessage}
                onChange={(event) => setSendMessage(event.target.checked)}
                className="mt-0.5 h-4 w-4 flex-none accent-[var(--blue-500)]"
              />
              <span>
                <span className="block text-[13px] font-semibold text-[var(--ink)]">Mensagem de cobrança</span>
                <span className="block text-[11.5px] text-[var(--ink-soft)]">Texto avisando sobre a fatura.</span>
              </span>
            </label>

            {hasPix && (
              <label className="flex items-start gap-2.5 rounded-xl border border-[var(--border)] p-3">
                <input
                  type="checkbox"
                  checked={sendPixButton}
                  onChange={(event) => setSendPixButton(event.target.checked)}
                  className="mt-0.5 h-4 w-4 flex-none accent-[var(--blue-500)]"
                />
                <span>
                  <span className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--ink)]">
                    <QrCodeIcon className="h-3.5 w-3.5" /> Botão de pagamento PIX
                  </span>
                  <span className="block text-[11.5px] text-[var(--ink-soft)]">
                    Manda o botão com a chave PIX copia e cola, pronto pra pagar direto no WhatsApp.
                  </span>
                </span>
              </label>
            )}

            {hasBoleto && (
              <label className="flex items-start gap-2.5 rounded-xl border border-[var(--border)] p-3">
                <input
                  type="checkbox"
                  checked={sendBoleto}
                  onChange={(event) => setSendBoleto(event.target.checked)}
                  className="mt-0.5 h-4 w-4 flex-none accent-[var(--blue-500)]"
                />
                <span>
                  <span className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--ink)]">
                    <FileTextIcon className="h-3.5 w-3.5" /> Boleto em PDF
                  </span>
                  <span className="block text-[11.5px] text-[var(--ink-soft)]">Manda o arquivo do boleto para download.</span>
                </span>
              </label>
            )}

            {!hasPix && !hasBoleto && (
              <p className="text-[11.5px] text-[var(--muted)]">
                Gere o PIX ou o boleto dessa conta para poder enviá-los junto com a cobrança.
              </p>
            )}
          </div>

          {sendMessage && (
            <div className="mt-4">
              <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                Prévia da mensagem
              </p>
              <div className="max-h-40 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--page)] p-3 text-[12.5px] whitespace-pre-wrap text-[var(--ink-soft)]">
                {previewLoading ? 'Carregando prévia…' : previewMessage || '—'}
              </div>
            </div>
          )}

          {hasPix && (
            <div className="mt-4">
              <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                Código PIX copia e cola
              </p>
              <CopyField value={bill.pix_copia_e_cola as string} label="PIX" />
            </div>
          )}

          {hasBoleto && (
            <div className="mt-4">
              <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                Linha digitável do boleto
              </p>
              <CopyField value={bill.boleto_linha_digital as string} label="linha digitável" />
            </div>
          )}
        </div>

        {error && <p className="px-6 pt-3 text-[13px] font-medium text-[var(--red-500)]">{error}</p>}

        <div className="mt-4 flex items-center justify-end gap-3 border-t border-[var(--border)] p-4 px-6">
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
            disabled={sending || nothingSelected}
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
