import { useEffect, useState } from 'react'
import { printSupportContract, type SupportContractRecord } from '../lib/supportContracts'
import { printGlassContract } from '../lib/glass'
import { fetchContractTemplates, type ContractTemplateRecord } from '../lib/contractTemplates'
import { ApiError } from '../lib/api'
import { CheckCircleIcon, CloseIcon, PrinterIcon } from './icons'
import { Select } from './form/Select'
import type { AuthSession, AuthCompany } from '../lib/auth'

interface SupportContractPreviewModalProps {
  open: boolean
  session: AuthSession
  company: AuthCompany
  contract: Pick<SupportContractRecord, 'id' | 'people'> | null
  flow?: 'support' | 'glass'
  onClose: () => void
}

export function SupportContractPreviewModal({
  open,
  session,
  company,
  contract,
  flow = 'support',
  onClose,
}: SupportContractPreviewModalProps) {
  const [templates, setTemplates] = useState<ContractTemplateRecord[]>([])
  const [templateId, setTemplateId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [signed, setSigned] = useState(false)

  useEffect(() => {
    if (!open || !contract) return
    setTemplateId('')
    setTemplates([])

    fetchContractTemplates(session.token.token, company.id, { targetType: flow === 'glass' ? 'glass_order' : 'support_contract', limit: 100 })
      .then((res) => {
        const active = (res.data || []).filter((template) => template.is_active)
        setTemplates(active)
        if (active.length) setTemplateId(active[0].id)
      })
      .catch(() => setTemplates([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, contract, session.token.token, company.id])

  useEffect(() => {
    if (!open || !contract) return
    // Enquanto os modelos ainda estão carregando (templateId vazio mas a
    // empresa tem modelos ativos), espera a seleção padrão cair pra não
    // gerar a pré-visualização duas vezes com modelo errado.
    if (!templateId && templates.length > 0) return

    let cancelled = false
    setLoading(true)
    setError(null)
    setUrl(null)
    setSigned(false)

    const print = flow === 'glass' ? printGlassContract : printSupportContract
    print(session.token.token, contract.id, templateId || undefined)
      .then((res) => {
        if (cancelled) return
        setUrl(res.url)
        setSigned(Boolean(res.signed))
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof ApiError ? err.message : 'Não foi possível gerar a pré-visualização do contrato.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, contract, templateId, templates.length, flow, session.token.token])

  if (!open || !contract) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--surface)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-6 py-4">
        <div className="flex items-center gap-2.5">
          <span
            className={`flex h-9 w-9 items-center justify-center rounded-full ${
              signed ? 'bg-[var(--green-100)] text-[var(--green-600)]' : 'bg-[var(--blue-100)] text-[var(--blue-700)]'
            }`}
          >
            {signed ? <CheckCircleIcon className="h-4.5 w-4.5" /> : <PrinterIcon className="h-4.5 w-4.5" />}
          </span>
          <div>
            <h2 className="text-[15px] font-bold text-[var(--ink)]">{signed ? 'Contrato assinado' : 'Contrato'}</h2>
            <p className="text-[12.5px] text-[var(--ink-soft)]">{contract.people?.name ?? (flow === 'glass' ? 'Contrato da vidraçaria' : 'Contrato de suporte')}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {templates.length > 0 && !signed && (
            <div className="w-56">
              <Select value={templateId} onChange={setTemplateId} variant="page">
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.title}
                  </option>
                ))}
              </Select>
            </div>
          )}
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl bg-[var(--page)] px-3.5 py-2 text-[12.5px] font-bold text-[var(--blue-700)] hover:bg-[var(--blue-100)]"
            >
              {signed ? 'Abrir contrato assinado' : 'Abrir em nova aba'}
            </a>
          )}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--page)] hover:text-[var(--ink)]"
            aria-label="Fechar"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      {templates.length === 0 && !signed && (
        <div className="border-b border-[var(--border)] bg-[var(--amber-100)] px-6 py-2.5 text-[12.5px] font-medium text-[var(--amber-500)]">
          Nenhum modelo ativo do tipo "{flow === 'glass' ? 'Vidraçaria (pedido)' : 'Contrato de Suporte'}" cadastrado - mostrando um modelo padrão genérico. Cadastre um em
          Modelos de Contrato para personalizar.
        </div>
      )}

      <div className="flex-1 overflow-hidden bg-[var(--page)]">
        {loading ? (
          <div className="flex h-full items-center justify-center text-[13.5px] text-[var(--muted)]">
            Gerando pré-visualização…
          </div>
        ) : error ? (
          <div className="flex h-full items-center justify-center p-6 text-center text-[13.5px] font-medium text-[var(--red-500)]">
            {error}
          </div>
        ) : url ? (
          <iframe title="Pré-visualização do contrato" src={url} className="h-full w-full border-0" />
        ) : null}
      </div>
    </div>
  )
}
