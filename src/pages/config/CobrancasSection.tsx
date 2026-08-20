import { useState } from 'react'
import type { BillingWhatsappRule, ConfigPayload } from '../../lib/config'
import { MULTA_MODALIDADE_OPTIONS, JUROS_MODALIDADE_OPTIONS } from '../../lib/config'
import { SectionCard } from '../../components/SectionCard'
import { TextField } from '../../components/form/TextField'
import { SelectField } from '../../components/form/SelectField'
import { ClockIcon, LinkIcon, PlusIcon, TrashIcon, CheckCircleIcon, WalletIcon } from '../../components/icons'

interface CobrancasSectionProps {
  value: ConfigPayload
  onChange: (patch: Partial<ConfigPayload>) => void
}

const DEFAULT_RULES: BillingWhatsappRule[] = [
  { type: 'before', days: 10, active: true },
  { type: 'before', days: 5, active: true },
  { type: 'before', days: 4, active: true },
  { type: 'before', days: 3, active: true },
  { type: 'before', days: 2, active: true },
  { type: 'before', days: 1, active: true },
  { type: 'overdue', days: 0, active: true },
]

const BILLING_VARIABLES = [
  '{{nome}}',
  '{{primeiro_nome}}',
  '{{saudacao}}',
  '{{item}}',
  '{{vencimento}}',
  '{{valor}}',
  '{{valor_atualizado}}',
  '{{dias_para_vencer}}',
  '{{dias_atraso}}',
  '{{link_cliente}}',
  '{{pix}}',
  '{{linha_digitavel}}',
]

function defaultBeforeMessage(): string {
  return (
    `Olá, {{primeiro_nome}}! {{saudacao}}.\n\n` +
    `Estamos passando para lembrar sobre sua fatura.\n\n` +
    `*Item:* {{item}}\n` +
    `*Vencimento:* {{vencimento}}\n` +
    `*Valor:* {{valor}}\n\n` +
    `Para sua segurança e para visualizar o boleto completo ou a chave PIX, acesse nossa Área do Cliente:\n` +
    `👉 {{link_cliente}}\n\n` +
    `_Esta é uma mensagem automática._`
  )
}

function defaultOverdueMessage(): string {
  return (
    `Olá, {{primeiro_nome}}! {{saudacao}}.\n\n` +
    `Identificamos que existe uma fatura em aberto em seu cadastro.\n\n` +
    `*Item:* {{item}}\n` +
    `*Vencimento:* {{vencimento}}\n` +
    `*Valor original:* {{valor}}\n` +
    `*Valor atualizado:* {{valor_atualizado}}\n` +
    `*Dias em atraso:* {{dias_atraso}}\n\n` +
    `Para regularizar, acesse nossa Área do Cliente:\n` +
    `👉 {{link_cliente}}\n\n` +
    `_Esta é uma mensagem automática._`
  )
}

export function CobrancasSection({ value, onChange }: CobrancasSectionProps) {
  const [copiedVariable, setCopiedVariable] = useState<string | null>(null)
  const rules = value.billing_whatsapp_rules ?? []

  function updateRule(index: number, patch: Partial<BillingWhatsappRule>) {
    const next = rules.map((rule, i) => (i === index ? { ...rule, ...patch } : rule))
    onChange({ billing_whatsapp_rules: next })
  }

  function removeRule(index: number) {
    onChange({ billing_whatsapp_rules: rules.filter((_, i) => i !== index) })
  }

  function addRule() {
    onChange({ billing_whatsapp_rules: [...rules, { type: 'before', days: 1, active: true }] })
  }

  function restoreDefaultRules() {
    onChange({ billing_whatsapp_rules: DEFAULT_RULES })
  }

  function restoreDefaultMessages() {
    onChange({
      billing_whatsapp_message_before: defaultBeforeMessage(),
      billing_whatsapp_message_overdue: defaultOverdueMessage(),
    })
  }

  function copyVariable(variable: string) {
    navigator.clipboard.writeText(variable).then(() => {
      setCopiedVariable(variable)
      setTimeout(() => setCopiedVariable(null), 1500)
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionCard title="Regras de cobrança e inadimplência">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <SelectField
            label="Modalidade multa"
            value={value.multa_modalidade ?? ''}
            onChange={(event) => onChange({ multa_modalidade: Number(event.target.value) })}
          >
            <option value="" disabled>
              Selecione
            </option>
            {MULTA_MODALIDADE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>
          <TextField
            label="Valor da multa"
            icon={<WalletIcon className="h-4 w-4" />}
            type="number"
            value={value.multa_valor ?? ''}
            onChange={(event) => onChange({ multa_valor: Number(event.target.value) })}
          />
          <SelectField
            label="Modalidade juros"
            value={value.juros_modalidade ?? ''}
            onChange={(event) => onChange({ juros_modalidade: Number(event.target.value) })}
          >
            <option value="" disabled>
              Selecione
            </option>
            {JUROS_MODALIDADE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>
          <TextField
            label="Valor dos juros"
            icon={<WalletIcon className="h-4 w-4" />}
            type="number"
            value={value.juros_valor ?? ''}
            onChange={(event) => onChange({ juros_valor: Number(event.target.value) })}
          />
          <TextField
            label="Valor do desconto"
            icon={<WalletIcon className="h-4 w-4" />}
            type="number"
            value={value.desconto_valor ?? ''}
            onChange={(event) => onChange({ desconto_valor: Number(event.target.value) })}
          />
          <TextField
            label="Desconto (dias de antecipação)"
            icon={<ClockIcon className="h-4 w-4" />}
            type="number"
            value={value.desconto_dias_antecipacao ?? ''}
            onChange={(event) => onChange({ desconto_dias_antecipacao: Number(event.target.value) })}
          />
        </div>
      </SectionCard>

      <SectionCard title="Whatsapp" subtitle="Cobranças automáticas via WhatsApp">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <label className="flex items-center gap-2.5">
              <input
                type="checkbox"
                checked={Boolean(value.billing_whatsapp_enabled)}
                onChange={(event) => onChange({ billing_whatsapp_enabled: event.target.checked })}
                className="h-4 w-4 accent-[var(--blue-500)]"
              />
              <span className="text-[13.5px] font-semibold text-[var(--ink)]">Cobranças automáticas via WhatsApp ativas</span>
            </label>
            <label className="flex items-center gap-2.5">
              <input
                type="checkbox"
                checked={Boolean(value.billing_whatsapp_ai_mode)}
                onChange={(event) => onChange({ billing_whatsapp_ai_mode: event.target.checked })}
                className="h-4 w-4 accent-[var(--blue-500)]"
              />
              <span className="text-[13.5px] font-semibold text-[var(--ink)]">
                Usar IA para gerar as mensagens (os textos abaixo passam a servir apenas como referência de tom)
              </span>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Horário de início</span>
              <input
                type="time"
                value={value.billing_whatsapp_start_time ?? ''}
                onChange={(event) => onChange({ billing_whatsapp_start_time: event.target.value })}
                className="w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
              />
            </label>
            <TextField
              label="Intervalo mínimo (min)"
              icon={<ClockIcon className="h-4 w-4" />}
              type="number"
              value={value.billing_whatsapp_min_interval_minutes ?? ''}
              onChange={(event) => onChange({ billing_whatsapp_min_interval_minutes: Number(event.target.value) })}
            />
            <TextField
              label="Intervalo máximo (min)"
              icon={<ClockIcon className="h-4 w-4" />}
              type="number"
              value={value.billing_whatsapp_max_interval_minutes ?? ''}
              onChange={(event) => onChange({ billing_whatsapp_max_interval_minutes: Number(event.target.value) })}
            />
            <TextField
              label="URL da área do cliente"
              icon={<LinkIcon className="h-4 w-4" />}
              placeholder="https://…"
              value={value.billing_whatsapp_customer_area_url ?? ''}
              onChange={(event) => onChange({ billing_whatsapp_customer_area_url: event.target.value })}
            />
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-[13px] font-bold text-[var(--ink)]">Regras de disparo</h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={restoreDefaultRules}
                  className="rounded-xl border border-[var(--border)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink-soft)] hover:text-[var(--ink)]"
                >
                  Regras padrão
                </button>
                <button
                  type="button"
                  onClick={addRule}
                  className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink-soft)] hover:text-[var(--ink)]"
                >
                  <PlusIcon className="h-3.5 w-3.5" />
                  Adicionar regra
                </button>
              </div>
            </div>

            {rules.length === 0 ? (
              <p className="rounded-xl bg-[var(--page)] py-6 text-center text-[12.5px] text-[var(--muted)]">
                Nenhuma regra configurada.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {rules.map((rule, index) => (
                  <div key={index} className="flex flex-wrap items-center gap-3 rounded-xl bg-[var(--page)] px-4 py-3">
                    <SelectField
                      label="Tipo"
                      value={rule.type}
                      onChange={(event) => updateRule(index, { type: event.target.value as BillingWhatsappRule['type'] })}
                    >
                      <option value="before">Antes do vencimento</option>
                      <option value="overdue">Após o vencimento</option>
                    </SelectField>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Dias</span>
                      <input
                        type="number"
                        min={0}
                        value={rule.days}
                        onChange={(event) => updateRule(index, { days: Number(event.target.value) })}
                        className="w-24 rounded-xl bg-[var(--surface)] px-3 py-2 text-[13.5px] text-[var(--ink)] ring-1 ring-transparent focus:outline-none focus:ring-[var(--blue-300)]"
                      />
                    </label>
                    <label className="flex items-center gap-2 self-end pb-2">
                      <input
                        type="checkbox"
                        checked={rule.active}
                        onChange={(event) => updateRule(index, { active: event.target.checked })}
                        className="h-4 w-4 accent-[var(--blue-500)]"
                      />
                      <span className="text-[12.5px] font-semibold text-[var(--ink)]">Ativa</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => removeRule(index)}
                      className="ml-auto self-end rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--red-100)] hover:text-[var(--red-500)]"
                      aria-label="Remover regra"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-[13px] font-bold text-[var(--ink)]">Variáveis disponíveis</h3>
              <button
                type="button"
                onClick={restoreDefaultMessages}
                className="rounded-xl border border-[var(--border)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink-soft)] hover:text-[var(--ink)]"
              >
                Restaurar mensagens padrão
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {BILLING_VARIABLES.map((variable) => (
                <button
                  key={variable}
                  type="button"
                  onClick={() => copyVariable(variable)}
                  className="flex items-center gap-1 rounded-full bg-[var(--blue-100)] px-2.5 py-1 text-[11.5px] font-mono font-semibold text-[var(--blue-700)] hover:bg-[var(--blue-300)]"
                >
                  {copiedVariable === variable ? <CheckCircleIcon className="h-3 w-3" /> : null}
                  {variable}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Mensagem antes do vencimento</span>
              <textarea
                value={value.billing_whatsapp_message_before ?? ''}
                onChange={(event) => onChange({ billing_whatsapp_message_before: event.target.value })}
                rows={8}
                className="w-full resize-none rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[13.5px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Mensagem após o vencimento</span>
              <textarea
                value={value.billing_whatsapp_message_overdue ?? ''}
                onChange={(event) => onChange({ billing_whatsapp_message_overdue: event.target.value })}
                rows={8}
                className="w-full resize-none rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[13.5px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
              />
            </label>
          </div>
        </div>
      </SectionCard>
    </div>
  )
}
