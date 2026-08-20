import { useState } from 'react'
import type { ConfigPayload, ConfigRecord } from '../../lib/config'
import {
  SICREDI_BOLETO_TIPO_COBRANCA_OPTIONS,
  SICREDI_BOLETO_ESPECIE_DOCUMENTO_OPTIONS,
  SICREDI_BOLETO_NEGATIVAR_PROTESTO_OPTIONS,
  SICREDI_BOLETO_TIPO_DESCONTO_OPTIONS,
  SICREDI_BOLETO_TIPO_JUROS_PERCENTUAL_OPTIONS,
  consultarWebhookPixSicredi,
  configurarWebhookPixSicredi,
  consultarWebhookBoletoSicredi,
  criarWebhookBoletoSicredi,
  type SicrediWebhookResult,
} from '../../lib/config'
import { ApiError } from '../../lib/api'
import { SectionCard } from '../../components/SectionCard'
import { TextField } from '../../components/form/TextField'
import { SelectField } from '../../components/form/SelectField'
import { LockIcon, TagIcon, PaperclipIcon, WalletIcon, LinkIcon } from '../../components/icons'
import type { AuthSession, AuthCompany } from '../../lib/auth'

interface IntegracoesSectionProps {
  value: ConfigPayload
  onChange: (patch: Partial<ConfigPayload>) => void
  config: ConfigRecord | null
  session: AuthSession
  company: AuthCompany
}

function SicrediWebhookCard({
  title,
  onConsult,
  onSave,
}: {
  title: string
  onConsult: () => Promise<SicrediWebhookResult>
  onSave: () => Promise<SicrediWebhookResult>
}) {
  const [result, setResult] = useState<SicrediWebhookResult | null>(null)
  const [loading, setLoading] = useState<'consult' | 'save' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run(action: 'consult' | 'save', fn: () => Promise<SicrediWebhookResult>) {
    setLoading(action)
    setError(null)
    try {
      const res = await fn()
      setResult(res)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível consultar o webhook.')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="rounded-xl bg-[var(--page)] p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-1.5 text-[12.5px] font-bold text-[var(--ink)]">
          <LinkIcon className="h-3.5 w-3.5" /> {title}
        </h4>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => run('consult', onConsult)}
            disabled={loading !== null}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-[11.5px] font-bold text-[var(--ink-soft)] hover:text-[var(--ink)] disabled:opacity-60"
          >
            {loading === 'consult' ? 'Consultando…' : 'Consultar atual'}
          </button>
          <button
            type="button"
            onClick={() => run('save', onSave)}
            disabled={loading !== null}
            className="rounded-lg bg-[var(--blue-500)] px-3 py-1.5 text-[11.5px] font-bold text-white hover:bg-[var(--blue-700)] disabled:opacity-60"
          >
            {loading === 'save' ? 'Enviando…' : 'Atualizar webhook'}
          </button>
        </div>
      </div>
      {error && <p className="text-[12px] font-medium text-[var(--red-500)]">{error}</p>}
      {result && (
        <p className="truncate text-[12px] text-[var(--ink-soft)]">{result.url || 'Nenhum webhook configurado ainda.'}</p>
      )}
    </div>
  )
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number | undefined
  onChange: (value: number) => void
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12px] font-semibold text-[var(--ink-soft)]">{label}</span>
      <input
        type="number"
        value={value ?? ''}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
      />
    </label>
  )
}

export function IntegracoesSection({ value, onChange, config, session, company }: IntegracoesSectionProps) {
  const token = session.token.token
  return (
    <div className="flex flex-col gap-4">
      <SectionCard title="Sicredi PIX" subtitle="Chaves, certificados e regras de cobrança">
        <div className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <TextField
              label="Chave PIX"
              icon={<TagIcon className="h-4 w-4" />}
              value={value.sicredi_chave_pix ?? ''}
              onChange={(event) => onChange({ sicredi_chave_pix: event.target.value })}
            />
            <TextField
              label="Client ID"
              icon={<LockIcon className="h-4 w-4" />}
              value={value.sicredi_client_id ?? ''}
              onChange={(event) => onChange({ sicredi_client_id: event.target.value })}
            />
            <TextField
              label="Client Secret"
              icon={<LockIcon className="h-4 w-4" />}
              type="password"
              value={value.sicredi_client_secret ?? ''}
              onChange={(event) => onChange({ sicredi_client_secret: event.target.value })}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Certificado (.crt, .pem, .cer)</span>
              <label className="flex w-fit cursor-pointer items-center gap-2 rounded-xl border border-[var(--border)] px-3.5 py-2 text-[12.5px] font-bold text-[var(--ink-soft)] hover:text-[var(--ink)]">
                <PaperclipIcon className="h-3.5 w-3.5 flex-none" />
                {value.sicredi_cert_file?.name ?? config?.sicredi_cert_file_name ?? 'Selecionar arquivo'}
                <input
                  type="file"
                  accept=".crt,.pem,.cer"
                  className="hidden"
                  onChange={(event) => onChange({ sicredi_cert_file: event.target.files?.[0] })}
                />
              </label>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Chave privada (.key, .pem)</span>
              <label className="flex w-fit cursor-pointer items-center gap-2 rounded-xl border border-[var(--border)] px-3.5 py-2 text-[12.5px] font-bold text-[var(--ink-soft)] hover:text-[var(--ink)]">
                <PaperclipIcon className="h-3.5 w-3.5 flex-none" />
                {value.sicredi_key_file?.name ?? config?.sicredi_key_file_name ?? 'Selecionar arquivo'}
                <input
                  type="file"
                  accept=".key,.pem"
                  className="hidden"
                  onChange={(event) => onChange({ sicredi_key_file: event.target.files?.[0] })}
                />
              </label>
            </div>
          </div>

          <div>
            <h4 className="mb-3 text-[12.5px] font-bold text-[var(--ink)]">Regras de cobrança e inadimplência</h4>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <NumberField
                label="Validade após vencimento (dias)"
                value={value.sicredi_pix_validade_apos_vencimento}
                onChange={(v) => onChange({ sicredi_pix_validade_apos_vencimento: v })}
              />
              <NumberField
                label="Multa (modalidade)"
                value={value.sicredi_pix_multa_modalidade}
                onChange={(v) => onChange({ sicredi_pix_multa_modalidade: v })}
              />
              <NumberField
                label="Multa (valor)"
                value={value.sicredi_pix_multa_valor}
                onChange={(v) => onChange({ sicredi_pix_multa_valor: v })}
              />
              <NumberField
                label="Juros (modalidade)"
                value={value.sicredi_pix_juros_modalidade}
                onChange={(v) => onChange({ sicredi_pix_juros_modalidade: v })}
              />
              <NumberField
                label="Juros (valor)"
                value={value.sicredi_pix_juros_valor}
                onChange={(v) => onChange({ sicredi_pix_juros_valor: v })}
              />
              <NumberField
                label="Desconto (valor)"
                value={value.sicredi_pix_desconto_valor}
                onChange={(v) => onChange({ sicredi_pix_desconto_valor: v })}
              />
              <NumberField
                label="Desconto (dias de antecipação)"
                value={value.sicredi_pix_desconto_dias_antecipacao}
                onChange={(v) => onChange({ sicredi_pix_desconto_dias_antecipacao: v })}
              />
            </div>
          </div>

          <SicrediWebhookCard
            title="Webhook PIX"
            onConsult={() => consultarWebhookPixSicredi(token, company.id)}
            onSave={() => configurarWebhookPixSicredi(token, company.id, {})}
          />
        </div>
      </SectionCard>

      <SectionCard title="Sicredi Boleto" subtitle="Credenciais, emissão e regras de cobrança" defaultCollapsed>
        <div className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <TextField
              label="Usuário"
              icon={<LockIcon className="h-4 w-4" />}
              value={value.sicredi_boleto_username ?? ''}
              onChange={(event) => onChange({ sicredi_boleto_username: event.target.value })}
            />
            <TextField
              label="x-api-key"
              icon={<LockIcon className="h-4 w-4" />}
              type="password"
              value={value.sicredi_boleto_x_api_key ?? ''}
              onChange={(event) => onChange({ sicredi_boleto_x_api_key: event.target.value })}
            />
            <TextField
              label="Senha"
              icon={<LockIcon className="h-4 w-4" />}
              type="password"
              value={value.sicredi_boleto_password ?? ''}
              onChange={(event) => onChange({ sicredi_boleto_password: event.target.value })}
            />
            <TextField
              label="Cooperativa"
              icon={<WalletIcon className="h-4 w-4" />}
              value={value.sicredi_boleto_cooperativa ?? ''}
              onChange={(event) => onChange({ sicredi_boleto_cooperativa: event.target.value })}
            />
            <TextField
              label="Posto"
              icon={<WalletIcon className="h-4 w-4" />}
              value={value.sicredi_boleto_posto ?? ''}
              onChange={(event) => onChange({ sicredi_boleto_posto: event.target.value })}
            />
            <TextField
              label="Código do beneficiário"
              icon={<WalletIcon className="h-4 w-4" />}
              value={value.sicredi_boleto_codigo_beneficiario ?? ''}
              onChange={(event) => onChange({ sicredi_boleto_codigo_beneficiario: event.target.value })}
            />
            <SelectField
              label="Tipo de cobrança"
              value={value.sicredi_boleto_tipo_cobranca ?? ''}
              onChange={(event) => onChange({ sicredi_boleto_tipo_cobranca: event.target.value })}
            >
              <option value="">Selecione</option>
              {SICREDI_BOLETO_TIPO_COBRANCA_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectField>
            <SelectField
              label="Espécie do documento"
              value={value.sicredi_boleto_especie_documento ?? ''}
              onChange={(event) => onChange({ sicredi_boleto_especie_documento: event.target.value })}
            >
              <option value="">Selecione</option>
              {SICREDI_BOLETO_ESPECIE_DOCUMENTO_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectField>
            <NumberField
              label="Validade após vencimento (dias)"
              value={value.sicredi_boleto_validade_apos_vencimento}
              onChange={(v) => onChange({ sicredi_boleto_validade_apos_vencimento: v })}
            />
          </div>

          <div>
            <h4 className="mb-3 text-[12.5px] font-bold text-[var(--ink)]">Ações após o vencimento</h4>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <SelectField
                label="Negativar / Protestar"
                value={value.sicredi_boleto_negativar_protesto ?? '0'}
                onChange={(event) => onChange({ sicredi_boleto_negativar_protesto: event.target.value })}
              >
                {SICREDI_BOLETO_NEGATIVAR_PROTESTO_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectField>
              {value.sicredi_boleto_negativar_protesto === '1' && (
                <NumberField
                  label="Dias para protesto"
                  value={value.sicredi_boleto_dias_protesto_auto}
                  onChange={(v) => onChange({ sicredi_boleto_dias_protesto_auto: v })}
                />
              )}
              {value.sicredi_boleto_negativar_protesto === '2' && (
                <NumberField
                  label="Dias para negativação"
                  value={value.sicredi_boleto_dias_negativacao_auto}
                  onChange={(v) => onChange({ sicredi_boleto_dias_negativacao_auto: v })}
                />
              )}
            </div>
          </div>

          <div>
            <h4 className="mb-3 text-[12.5px] font-bold text-[var(--ink)]">Juros, multa e desconto</h4>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <SelectField
                label="Tipo de juros"
                value={value.sicredi_boleto_tipo_juros ?? 'VALOR'}
                onChange={(event) => onChange({ sicredi_boleto_tipo_juros: event.target.value })}
              >
                <option value="VALOR">R$ Fixo</option>
                <option value="PERCENTUAL">% Mensal</option>
              </SelectField>
              <NumberField
                label="Juros"
                value={value.sicredi_boleto_juros}
                onChange={(v) => onChange({ sicredi_boleto_juros: v })}
              />
              <SelectField
                label="Período do juros percentual"
                value={value.sicredi_boleto_tipo_juros_percentual ?? ''}
                onChange={(event) => onChange({ sicredi_boleto_tipo_juros_percentual: event.target.value })}
              >
                <option value="">Selecione</option>
                {SICREDI_BOLETO_TIPO_JUROS_PERCENTUAL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectField>
              <SelectField
                label="Tipo de multa"
                value={value.sicredi_boleto_tipo_multa ?? 'VALOR'}
                onChange={(event) => onChange({ sicredi_boleto_tipo_multa: event.target.value })}
              >
                <option value="VALOR">R$ Fixo</option>
                <option value="PERCENTUAL">% Única</option>
              </SelectField>
              <NumberField
                label="Multa"
                value={value.sicredi_boleto_multa}
                onChange={(v) => onChange({ sicredi_boleto_multa: v })}
              />
              <SelectField
                label="Tipo de desconto"
                value={value.sicredi_boleto_tipo_desconto ?? 'VALOR'}
                onChange={(event) => onChange({ sicredi_boleto_tipo_desconto: event.target.value })}
              >
                {SICREDI_BOLETO_TIPO_DESCONTO_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectField>
            </div>
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="grid grid-cols-2 gap-2 rounded-xl bg-[var(--page)] p-3">
                  <NumberField
                    label={`Desconto ${n}: valor`}
                    value={value[`sicredi_boleto_valor_desconto${n}` as keyof ConfigPayload] as number | undefined}
                    onChange={(v) => onChange({ [`sicredi_boleto_valor_desconto${n}`]: v })}
                  />
                  <NumberField
                    label={`Desconto ${n}: dias`}
                    value={value[`sicredi_boleto_dias_desconto${n}` as keyof ConfigPayload] as number | undefined}
                    onChange={(v) => onChange({ [`sicredi_boleto_dias_desconto${n}`]: v })}
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="mb-3 text-[12.5px] font-bold text-[var(--ink)]">Instruções impressas</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <TextField
                  key={`informativo${n}`}
                  label={`Informativo ${n}`}
                  icon={<TagIcon className="h-4 w-4" />}
                  value={(value[`sicredi_boleto_informativo${n}` as keyof ConfigPayload] as string) ?? ''}
                  onChange={(event) => onChange({ [`sicredi_boleto_informativo${n}`]: event.target.value })}
                />
              ))}
              {[1, 2, 3, 4].map((n) => (
                <TextField
                  key={`mensagem${n}`}
                  label={`Mensagem ${n}`}
                  icon={<TagIcon className="h-4 w-4" />}
                  value={(value[`sicredi_boleto_mensagem${n}` as keyof ConfigPayload] as string) ?? ''}
                  onChange={(event) => onChange({ [`sicredi_boleto_mensagem${n}`]: event.target.value })}
                />
              ))}
            </div>
          </div>

          <SicrediWebhookCard
            title="Webhook Boleto"
            onConsult={() => consultarWebhookBoletoSicredi(token, company.id)}
            onSave={() => criarWebhookBoletoSicredi(token, company.id, {})}
          />
        </div>
      </SectionCard>
    </div>
  )
}
