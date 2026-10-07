import { useEffect, useMemo, useState } from 'react'
import type { ConfigPayload } from '../../lib/config'
import { API_BASE_URL } from '../../lib/api'
import { SectionCard } from '../../components/SectionCard'
import { TextField } from '../../components/form/TextField'
import {
  LinkIcon,
  LockIcon,
  TagIcon,
  CheckCircleIcon,
  PaperclipIcon,
  TrashIcon,
  MailIcon,
  WhatsappIcon,
} from '../../components/icons'

interface AssinaturaDigitalSectionProps {
  value: ConfigPayload
  onChange: (patch: Partial<ConfigPayload>) => void
}

export function AssinaturaDigitalSection({ value, onChange }: AssinaturaDigitalSectionProps) {
  const [copied, setCopied] = useState(false)
  const webhookUrl = `${API_BASE_URL}/connect/autentique/webhook`

  const signaturePreviewUrl = useMemo(
    () => (value.autentique_signature_file ? URL.createObjectURL(value.autentique_signature_file) : null),
    [value.autentique_signature_file]
  )
  useEffect(() => {
    return () => {
      if (signaturePreviewUrl) URL.revokeObjectURL(signaturePreviewUrl)
    }
  }, [signaturePreviewUrl])

  // Mostra o arquivo recém-escolhido (ainda não salvo) se tiver, senão a
  // imagem já salva (a menos que tenha marcado pra remover, ''), senão nada.
  const currentSignatureUrl =
    signaturePreviewUrl ?? (value.autentique_signer_signature_url === '' ? null : value.autentique_signer_signature_url)

  function handleCopy() {
    navigator.clipboard.writeText(webhookUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionCard
        title="Assinatura da empresa"
        subtitle="Carimbada em todos os contratos, seja pela assinatura própria ou pelo Autentique"
      >
        <div className="rounded-xl bg-[var(--page)] p-4">
          <div className="flex items-center gap-4">
            <span className="flex h-16 w-28 flex-none items-center justify-center overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]">
              {currentSignatureUrl ? (
                <img src={currentSignatureUrl} alt="Assinatura da empresa" className="h-full w-full object-contain" />
              ) : (
                <PaperclipIcon className="h-5 w-5" />
              )}
            </span>
            <div className="flex flex-col gap-1.5">
              <label className="flex w-fit cursor-pointer items-center gap-2 rounded-xl border border-[var(--border)] px-3.5 py-2 text-[12.5px] font-bold text-[var(--ink-soft)] hover:text-[var(--ink)]">
                <PaperclipIcon className="h-3.5 w-3.5 flex-none" />
                {value.autentique_signature_file ? value.autentique_signature_file.name : 'Selecionar imagem'}
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg"
                  className="hidden"
                  onChange={(event) =>
                    onChange({
                      autentique_signature_file: event.target.files?.[0],
                      autentique_signer_signature_url: undefined,
                    })
                  }
                />
              </label>
              {currentSignatureUrl && (
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      autentique_signature_file: undefined,
                      autentique_signer_signature_url: '',
                    })
                  }
                  className="flex w-fit items-center gap-1.5 text-[11.5px] font-bold text-[var(--red-500)] hover:underline"
                >
                  <TrashIcon className="h-3 w-3" /> Remover
                </button>
              )}
            </div>
          </div>

          <p className="mt-3 text-[11.5px] text-[var(--ink-soft)]">
            Imagem (PNG/JPG, fundo transparente de preferência) da assinatura de quem assina pela empresa. Ela é
            carimbada direto no PDF de todo contrato enviado, na posição definida em Modelos de Contrato, e vale tanto
            pra assinatura própria quanto pro Autentique — ninguém do lado da empresa precisa assinar depois.
          </p>
        </div>
      </SectionCard>

      <SectionCard
        title="Assinatura própria"
        subtitle="O cliente recebe um link, confirma o que você exigir e desenha a rubrica — sem precisar do Autentique"
      >
        <div className="flex flex-col gap-4">
          <label className="flex items-center gap-2.5">
            <input
              type="checkbox"
              checked={Boolean(value.signature_native_enabled)}
              onChange={(event) => onChange({ signature_native_enabled: event.target.checked })}
              className="h-4 w-4 accent-[var(--blue-500)]"
            />
            <span className="text-[13.5px] font-semibold text-[var(--ink)]">
              Usar assinatura própria em vez do Autentique
            </span>
          </label>

          {value.signature_native_enabled && (
            <div className="flex flex-col gap-4 rounded-xl bg-[var(--page)] p-4">
              <div>
                <p className="mb-2 text-[12px] font-semibold text-[var(--ink-soft)]">O que o cliente precisa fazer</p>
                <div className="flex flex-col gap-3">
                  <label className="flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      checked={value.signature_require_code !== false}
                      onChange={(event) => onChange({ signature_require_code: event.target.checked })}
                      className="mt-0.5 h-4 w-4 accent-[var(--blue-500)]"
                    />
                    <span>
                      <span className="block text-[13.5px] font-semibold text-[var(--ink)]">
                        Confirmar por código de 6 dígitos
                      </span>
                      <span className="block text-[12px] text-[var(--ink-soft)]">
                        O cliente recebe um código por e-mail ou WhatsApp antes de assinar.
                      </span>
                    </span>
                  </label>

                  {value.signature_require_code !== false && (
                    <div className="ml-6 flex flex-col gap-2 sm:flex-row sm:gap-5">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={Boolean(value.signature_allow_email)}
                          onChange={(event) => onChange({ signature_allow_email: event.target.checked })}
                          className="h-4 w-4 accent-[var(--blue-500)]"
                        />
                        <MailIcon className="h-4 w-4 text-[var(--ink-soft)]" />
                        <span className="text-[13px] text-[var(--ink)]">Permitir receber por e-mail</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={Boolean(value.signature_allow_whatsapp)}
                          onChange={(event) => onChange({ signature_allow_whatsapp: event.target.checked })}
                          className="h-4 w-4 accent-[var(--blue-500)]"
                        />
                        <WhatsappIcon className="h-4 w-4 text-[var(--ink-soft)]" />
                        <span className="text-[13px] text-[var(--ink)]">Permitir receber por WhatsApp</span>
                      </label>
                    </div>
                  )}
                  {value.signature_require_code !== false && value.signature_allow_whatsapp && (
                    <p className="ml-6 text-[11.5px] text-[var(--ink-soft)]">
                      O código sai pelo mesmo WhatsApp que você escolhe na hora de enviar o contrato.
                    </p>
                  )}

                  <label className="flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      checked={value.signature_require_selfie !== false}
                      onChange={(event) => onChange({ signature_require_selfie: event.target.checked })}
                      className="mt-0.5 h-4 w-4 accent-[var(--blue-500)]"
                    />
                    <span>
                      <span className="block text-[13.5px] font-semibold text-[var(--ink)]">
                        Fazer facial (selfie) e registrar localização
                      </span>
                      <span className="block text-[12px] text-[var(--ink-soft)]">
                        O cliente tira uma foto ao vivo e libera a localização antes de assinar.
                      </span>
                    </span>
                  </label>
                </div>
              </div>

              {value.signature_require_code === false && value.signature_require_selfie === false && (
                <p className="rounded-lg bg-[var(--amber-100)] px-3 py-2 text-[12px] font-medium text-[var(--amber-500)]">
                  Sem código e sem facial, quem tiver o link consegue assinar. O sistema registra rubrica, data e
                  hora, IP e aparelho, mas não confirma a identidade de quem assinou.
                </p>
              )}
              {!currentSignatureUrl && (
                <p className="rounded-lg bg-[var(--amber-100)] px-3 py-2 text-[12px] font-medium text-[var(--amber-500)]">
                  Cadastre a assinatura da empresa no card acima — sem ela o contrato assinado pelo cliente sai sem a
                  assinatura da empresa.
                </p>
              )}
              <p className="text-[11.5px] text-[var(--ink-soft)]">
                A rubrica desenhada pelo cliente é carimbada no PDF na mesma posição configurada em Modelos de Contrato
                (campo "Posição da assinatura do cliente").
              </p>
            </div>
          )}
        </div>
      </SectionCard>

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
            <div className="flex flex-col gap-1.5">
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
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  )
}
