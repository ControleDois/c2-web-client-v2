import { useState } from 'react'
import type { ConfigPayload } from '../../lib/config'
import { API_BASE_URL } from '../../lib/api'
import { SectionCard } from '../../components/SectionCard'
import { TextField } from '../../components/form/TextField'
import { LinkIcon, LockIcon, TagIcon, CheckCircleIcon } from '../../components/icons'

interface AssinaturaDigitalSectionProps {
  value: ConfigPayload
  onChange: (patch: Partial<ConfigPayload>) => void
}

export function AssinaturaDigitalSection({ value, onChange }: AssinaturaDigitalSectionProps) {
  const [copied, setCopied] = useState(false)
  const webhookUrl = `${API_BASE_URL}/connect/autentique/webhook`

  function handleCopy() {
    navigator.clipboard.writeText(webhookUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <SectionCard title="Autentique" subtitle="Integração com a API de assinatura digital">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="URL da API"
          icon={<LinkIcon className="h-4 w-4" />}
          placeholder="https://api.autentique.com.br/v2/graphql"
          value={value.autentique_api_url ?? ''}
          onChange={(event) => onChange({ autentique_api_url: event.target.value })}
        />
        <TextField
          label="Token da API"
          icon={<LockIcon className="h-4 w-4" />}
          type="password"
          placeholder="Token de acesso"
          value={value.autentique_api_token ?? ''}
          onChange={(event) => onChange({ autentique_api_token: event.target.value })}
        />
        <TextField
          label="ID da pasta"
          icon={<TagIcon className="h-4 w-4" />}
          placeholder="Opcional"
          value={value.autentique_folder_id ?? ''}
          onChange={(event) => onChange({ autentique_folder_id: event.target.value })}
        />
        <TextField
          label="URL do conversor de PDF"
          icon={<LinkIcon className="h-4 w-4" />}
          placeholder="Opcional"
          value={value.autentique_pdf_converter_url ?? ''}
          onChange={(event) => onChange({ autentique_pdf_converter_url: event.target.value })}
        />
        <TextField
          label="Segredo do webhook"
          icon={<LockIcon className="h-4 w-4" />}
          type="password"
          placeholder="Opcional"
          value={value.autentique_webhook_secret ?? ''}
          onChange={(event) => onChange({ autentique_webhook_secret: event.target.value })}
        />

        <div className="sm:col-span-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-[var(--ink-soft)]">URL do webhook (somente leitura)</span>
            <div className="flex items-center gap-2 rounded-xl bg-[var(--page)] px-3.5 py-2.5">
              <LinkIcon className="h-4 w-4 flex-none text-[var(--muted)]" />
              <span className="w-full truncate text-[13px] text-[var(--ink-soft)]">{webhookUrl}</span>
              <button
                type="button"
                onClick={handleCopy}
                className="flex-none rounded-lg px-2.5 py-1 text-[12px] font-bold text-[var(--blue-700)] hover:bg-[var(--blue-100)]"
              >
                {copied ? (
                  <span className="flex items-center gap-1">
                    <CheckCircleIcon className="h-3.5 w-3.5" /> Copiado
                  </span>
                ) : (
                  'Copiar'
                )}
              </button>
            </div>
          </label>
        </div>
      </div>
    </SectionCard>
  )
}
