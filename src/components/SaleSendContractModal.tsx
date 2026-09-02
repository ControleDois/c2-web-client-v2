import { useEffect, useState } from 'react'
import { sendSaleContract, sendSaleContractLink, getContractLink, type SaleRecord } from '../lib/sales'
import { fetchContractTemplates, type ContractTemplateRecord } from '../lib/contractTemplates'
import { fetchCompanyWhatsapps, type CompanyWhatsappRecord } from '../lib/companyWhatsapp'
import { ApiError } from '../lib/api'
import { CloseIcon, WhatsappIcon } from './icons'
import { SelectField } from './form/SelectField'
import type { AuthSession, AuthCompany } from '../lib/auth'

interface SaleSendContractModalProps {
  open: boolean
  session: AuthSession
  company: AuthCompany
  sale: SaleRecord | null
  onClose: () => void
  onSent: (message: string) => void
}

export function SaleSendContractModal({
  open,
  session,
  company,
  sale,
  onClose,
  onSent,
}: SaleSendContractModalProps) {
  const [templates, setTemplates] = useState<ContractTemplateRecord[]>([])
  const [whatsapps, setWhatsapps] = useState<CompanyWhatsappRecord[]>([])
  const [templateId, setTemplateId] = useState('')
  const [whatsappId, setWhatsappId] = useState('')
  const [useAutentique, setUseAutentique] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !sale) return
    setTemplateId('')
    setWhatsappId('')
    setUseAutentique(true)
    setError(null)

    const targetType = sale.vehicleRentalContract?.purchaseOption
      ? 'vehicle_rental_purchase_option'
      : 'vehicle_rental'

    fetchContractTemplates(session.token.token, company.id, { targetType, limit: 100 })
      .then((res) => {
        const active = (res.data || []).filter((template) => template.is_active)
        setTemplates(active)
        if (active.length) setTemplateId(active[0].id)
      })
      .catch(() => setTemplates([]))

    fetchCompanyWhatsapps(session.token.token, company.id, { limit: 100 })
      .then((res) => {
        setWhatsapps((res.data || []).filter((whatsapp) => !whatsapp.official_whatsapp))
      })
      .catch(() => setWhatsapps([]))
  }, [open, sale, session.token.token, company.id])

  if (!open || !sale) return null

  const hasLink = Boolean(getContractLink(sale))

  async function handleConfirmSend() {
    if (!sale) return
    if (!templateId) {
      setError('Selecione o modelo de contrato.')
      return
    }
    if (!whatsappId) {
      setError('Selecione o WhatsApp que enviará o contrato.')
      return
    }

    setSending(true)
    setError(null)
    try {
      const result = await sendSaleContract(session.token.token, sale.id, {
        contractTemplateId: templateId,
        whatsappId,
        useAutentique,
      })
      if (result.whatsappError) {
        onSent(`Contrato gerado, mas o WhatsApp falhou: ${result.whatsappError}`)
      } else {
        onSent(
          useAutentique
            ? hasLink
              ? 'O novo contrato foi colocado na fila do WhatsApp.'
              : 'O contrato foi colocado na fila do WhatsApp (com link de assinatura, se o Autentique estiver configurado).'
            : 'O arquivo do contrato foi colocado na fila do WhatsApp, sem assinatura digital.'
        )
      }
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível enviar o contrato.')
    } finally {
      setSending(false)
    }
  }

  async function handleResendLink() {
    if (!sale) return
    if (!whatsappId) {
      setError('Selecione o WhatsApp que enviará o link.')
      return
    }

    setSending(true)
    setError(null)
    try {
      await sendSaleContractLink(session.token.token, sale.id, whatsappId)
      onSent('O link existente foi colocado na fila do WhatsApp.')
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível enviar o link.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={sending ? undefined : onClose}>
      <div
        className="w-full max-w-[480px] rounded-2xl bg-[var(--surface)] p-6 shadow-[var(--card-shadow)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[15px] font-bold text-[var(--ink)]">Contrato e envio</h2>
            <p className="mt-1 text-[12.5px] text-[var(--ink-soft)]">
              {hasLink
                ? 'Reenvie o link já gerado ou gere um novo contrato.'
                : 'Sem link do Autentique, o WhatsApp enviará o arquivo do contrato em PDF.'}
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

        {hasLink && (
          <div className="mt-4 rounded-xl bg-[var(--green-100)] p-3.5">
            <p className="text-[13px] font-bold text-[var(--green-600)]">Contrato já gerado no Autentique</p>
            <p className="mt-1 text-[11.5px] break-all text-[var(--green-600)]">{getContractLink(sale)}</p>
          </div>
        )}

        <div className="mt-4 flex flex-col gap-1.5">
          <SelectField
            label="Modelo de contrato"
            value={templateId}
            onChange={(event) => setTemplateId(event.target.value)}
          >
            <option value="">Selecione</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.title}
              </option>
            ))}
          </SelectField>
          {templates.length === 0 && (
            <p className="text-[11.5px] font-medium text-[var(--amber-500)]">
              Cadastre um modelo ativo de contrato de locação.
            </p>
          )}
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
            {hasLink
              ? 'Quando reenviar, será enviado o link existente.'
              : 'Quando não existir link de assinatura, será enviado o arquivo do contrato.'}
          </p>
        </div>

        <label className="mt-4 flex items-start gap-2.5 rounded-xl bg-[var(--page)] p-3">
          <input
            type="checkbox"
            checked={useAutentique}
            onChange={(event) => setUseAutentique(event.target.checked)}
            className="mt-0.5 h-4 w-4 flex-none rounded border-[var(--border)] accent-[var(--blue-500)]"
          />
          <span>
            <span className="block text-[13px] font-semibold text-[var(--ink)]">
              Enviar para assinatura digital (Autentique)
            </span>
            <span className="mt-0.5 block text-[11.5px] text-[var(--ink-soft)]">
              Desmarque se o cliente não usa assinatura digital — o contrato vai só como
              arquivo PDF pelo WhatsApp, sem passar pelo Autentique.
            </span>
          </span>
        </label>

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
          {hasLink && (
            <button
              type="button"
              onClick={handleResendLink}
              disabled={sending}
              className="rounded-xl bg-[var(--page)] px-4 py-2 text-[13.5px] font-bold text-[var(--ink-soft)] hover:text-[var(--ink)] disabled:opacity-60"
            >
              Reenviar link
            </button>
          )}
          <button
            type="button"
            onClick={handleConfirmSend}
            disabled={sending}
            className="flex items-center gap-2 rounded-xl bg-[var(--blue-500)] px-4 py-2 text-[13.5px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:opacity-60"
          >
            <WhatsappIcon className="h-4 w-4" />
            {sending ? 'Enviando…' : hasLink ? 'Gerar novo contrato' : 'Enviar arquivo'}
          </button>
        </div>
      </div>
    </div>
  )
}
