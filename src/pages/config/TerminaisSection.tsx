import { useEffect, useState } from 'react'
import type { ConfigPayload, ConfigRecord, CompanyTerminalPayload } from '../../lib/config'
import { fetchNfeNatureOperations, type NfeNatureOperationRecord } from '../../lib/nfeNatureOperations'
import { SectionCard } from '../../components/SectionCard'
import { TextField } from '../../components/form/TextField'
import { SelectField } from '../../components/form/SelectField'
import { SearchSelectField } from '../../components/form/SearchSelectField'
import {
  PlusIcon,
  TrashIcon,
  LinkIcon,
  TagIcon,
  FileTextIcon,
  PrinterIcon,
  ShieldIcon,
  WrenchIcon,
  CreditCardIcon,
  KeyIcon,
  ChevronDownIcon,
  BuildingIcon,
} from '../../components/icons'
import type { AuthSession, AuthCompany } from '../../lib/auth'

interface TerminaisSectionProps {
  value: ConfigPayload
  onChange: (patch: Partial<ConfigPayload>) => void
  config: ConfigRecord | null
  session: AuthSession
  company: AuthCompany
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 flex-none rounded-full transition ${checked ? 'bg-[var(--blue-500)]' : 'bg-[var(--border)]'}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${checked ? 'left-5.5' : 'left-0.5'}`}
      />
    </button>
  )
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number | null | undefined
  onChange: (value: number | undefined) => void
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12px] font-semibold text-[var(--ink-soft)]">{label}</span>
      <input
        type="number"
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value === '' ? undefined : Number(event.target.value))}
        className="w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
      />
    </label>
  )
}

function GroupHeading({ children }: { children: string }) {
  return <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">{children}</p>
}

// Terminal = um PDV físico (caixa, balcão). O operador escolhe um desses ao
// entrar no PDV web; se ele tiver "Link do servidor local" (um
// c2-delphi-server rodando na máquina/rede do caixa), a emissão de
// NF-e/NFC-e passa a usar esse link em vez do servidor padrão. Os demais
// campos (impressora, certificado, balança, TEF) espelham 1:1 a tabela
// company_terminals - existem pra edição centralizada do cadastro completo
// do terminal, mesmo que o PDV web hoje só leia name/active/api_url.
export function TerminaisSection({ value, onChange, config, session, company }: TerminaisSectionProps) {
  const terminals = value.terminals ?? []
  const [expanded, setExpanded] = useState<number | null>(null)
  const [natureLabels, setNatureLabels] = useState<Record<number, string | null>>({})

  useEffect(() => {
    const labels: Record<number, string | null> = {}
    ;(config?.company?.terminals ?? []).forEach((terminal, index) => {
      labels[index] = terminal.natureOperation?.description ?? null
    })
    setNatureLabels(labels)
  }, [config])

  function update(index: number, patch: Partial<CompanyTerminalPayload>) {
    const next = terminals.map((terminal, i) => (i === index ? { ...terminal, ...patch } : terminal))
    onChange({ terminals: next })
  }

  function remove(index: number) {
    onChange({ terminals: terminals.filter((_, i) => i !== index) })
    setNatureLabels((current) => {
      const next: Record<number, string | null> = {}
      Object.entries(current).forEach(([key, label]) => {
        const i = Number(key)
        if (i < index) next[i] = label
        else if (i > index) next[i - 1] = label
      })
      return next
    })
  }

  function add() {
    onChange({
      terminals: [...terminals, { name: `Terminal ${terminals.length + 1}`, active: true }],
    })
    setExpanded(terminals.length)
  }

  return (
    <SectionCard
      title="Terminais (PDV)"
      subtitle="Cada caixa/balcão que usa o PDV web - o operador escolhe um ao entrar"
    >
      <div className="flex flex-col gap-3">
        {terminals.length === 0 && (
          <p className="rounded-xl bg-[var(--page)] px-4 py-6 text-center text-[12.5px] text-[var(--muted)]">
            Nenhum terminal cadastrado. Sem terminais, o PDV web usa direto o servidor padrão pra todo mundo.
          </p>
        )}

        {terminals.map((terminal, index) => {
          const isOpen = expanded === index
          return (
            <div key={terminal.id ?? `new-${index}`} className="rounded-2xl border border-[var(--border)]">
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : index)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`h-2 w-2 flex-none rounded-full ${terminal.active ? 'bg-[var(--green-500)]' : 'bg-[var(--border)]'}`}
                  />
                  <div>
                    <p className="text-[13.5px] font-bold text-[var(--ink)]">{terminal.name || `Terminal ${index + 1}`}</p>
                    <p className="text-[11px] text-[var(--muted)]">
                      {terminal.api_url ? 'Servidor local próprio' : 'Servidor padrão'}
                    </p>
                  </div>
                </div>
                <ChevronDownIcon
                  className={`h-4 w-4 flex-none text-[var(--muted)] transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {isOpen && (
                <div className="flex flex-col gap-5 border-t border-[var(--border)] p-4">
                  <div>
                    <GroupHeading>Identificação</GroupHeading>
                    <div className="mt-2 grid gap-4 sm:grid-cols-2">
                      <TextField
                        label="Nome do terminal"
                        icon={<TagIcon className="h-4 w-4" />}
                        value={terminal.name}
                        onChange={(event) => update(index, { name: event.target.value })}
                        placeholder="Caixa 1"
                      />
                      <div className="flex items-center justify-between rounded-xl bg-[var(--page)] px-3.5 py-2.5">
                        <span className="text-[12.5px] font-semibold text-[var(--ink)]">Terminal ativo</span>
                        <Toggle checked={Boolean(terminal.active)} onChange={(active) => update(index, { active })} />
                      </div>
                    </div>
                  </div>

                  <div>
                    <GroupHeading>Vínculo com o PDV</GroupHeading>
                    <div className="mt-2 grid gap-4 sm:grid-cols-2">
                      <TextField
                        label="Link do servidor local (opcional)"
                        icon={<LinkIcon className="h-4 w-4" />}
                        value={terminal.api_url ?? ''}
                        onChange={(event) => update(index, { api_url: event.target.value || undefined })}
                        placeholder="http://192.168.0.50:8080"
                      />
                      <TextField
                        label="Caminho do servidor"
                        icon={<LinkIcon className="h-4 w-4" />}
                        value={terminal.path_server ?? ''}
                        onChange={(event) => update(index, { path_server: event.target.value || undefined })}
                      />
                    </div>
                    <p className="mt-1.5 text-[11px] text-[var(--muted)]">
                      Deixe o link em branco pra esse terminal usar o servidor padrão da empresa. Preencha só se
                      houver um c2-delphi-server rodando na máquina/rede desse caixa.
                    </p>
                  </div>

                  <div>
                    <GroupHeading>NF-e</GroupHeading>
                    <div className="mt-2 flex flex-col gap-4">
                      <SearchSelectField
                        label="Natureza de operação (NF-e e NFC-e)"
                        placeholder="Buscar natureza de operação…"
                        selectedLabel={natureLabels[index] ?? null}
                        onSearch={(query) =>
                          fetchNfeNatureOperations(session.token.token, company.id, { search: query, limit: 8 }).then(
                            (res) => res.data
                          )
                        }
                        getOptionLabel={(item: NfeNatureOperationRecord) => item.description}
                        onSelect={(item: NfeNatureOperationRecord) => {
                          setNatureLabels((current) => ({ ...current, [index]: item.description }))
                          update(index, { nfeNatureOperationId: item.id })
                        }}
                        onClear={() => {
                          setNatureLabels((current) => ({ ...current, [index]: null }))
                          update(index, { nfeNatureOperationId: undefined })
                        }}
                      />
                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <SelectField
                          label="Ambiente"
                          value={terminal.nfe_ambiente ?? ''}
                          onChange={(event) =>
                            update(index, {
                              nfe_ambiente: event.target.value === '' ? undefined : Number(event.target.value),
                            })
                          }
                        >
                          <option value="">Usar da empresa</option>
                          <option value={0}>Produção</option>
                          <option value={1}>Homologação</option>
                        </SelectField>
                        <NumberField label="Série" value={terminal.nfe_serie} onChange={(v) => update(index, { nfe_serie: v })} />
                        <NumberField
                          label="Próximo número"
                          value={terminal.nfe_numero}
                          onChange={(v) => update(index, { nfe_numero: v })}
                        />
                        <div className="flex items-center justify-between rounded-xl bg-[var(--page)] px-3.5 py-2.5">
                          <span className="text-[12.5px] font-semibold text-[var(--ink)]">Emite NF-e</span>
                          <Toggle
                            checked={Number(terminal.nfe_active) === 1}
                            onChange={(active) => update(index, { nfe_active: active ? 1 : 0 })}
                          />
                        </div>
                      </div>
                      <TextField
                        label="Nome da impressora (NF-e)"
                        icon={<PrinterIcon className="h-4 w-4" />}
                        value={terminal.nfe_nome_impressora ?? ''}
                        onChange={(event) => update(index, { nfe_nome_impressora: event.target.value || undefined })}
                      />
                    </div>
                  </div>

                  <div>
                    <GroupHeading>NFC-e</GroupHeading>
                    <div className="mt-2 flex flex-col gap-4">
                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <SelectField
                          label="Ambiente"
                          value={terminal.nfce_ambiente ?? ''}
                          onChange={(event) =>
                            update(index, {
                              nfce_ambiente: event.target.value === '' ? undefined : Number(event.target.value),
                            })
                          }
                        >
                          <option value="">Usar da empresa</option>
                          <option value={0}>Produção</option>
                          <option value={1}>Homologação</option>
                        </SelectField>
                        <NumberField label="Série" value={terminal.nfce_serie} onChange={(v) => update(index, { nfce_serie: v })} />
                        <NumberField
                          label="Próximo número"
                          value={terminal.nfce_numero}
                          onChange={(v) => update(index, { nfce_numero: v })}
                        />
                        <div className="flex items-center justify-between rounded-xl bg-[var(--page)] px-3.5 py-2.5">
                          <span className="text-[12.5px] font-semibold text-[var(--ink)]">Emite NFC-e</span>
                          <Toggle
                            checked={Number(terminal.nfce_active) === 1}
                            onChange={(active) => update(index, { nfce_active: active ? 1 : 0 })}
                          />
                        </div>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <NumberField
                          label="IdCSC"
                          value={terminal.nfce_id_token}
                          onChange={(v) => update(index, { nfce_id_token: v })}
                        />
                        <TextField
                          label="CSC"
                          icon={<KeyIcon className="h-4 w-4" />}
                          type="password"
                          value={terminal.nfce_csc ?? ''}
                          onChange={(event) => update(index, { nfce_csc: event.target.value || undefined })}
                        />
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <TextField
                          label="Nome da impressora (NFC-e)"
                          icon={<PrinterIcon className="h-4 w-4" />}
                          value={terminal.nfce_nome_impressora ?? ''}
                          onChange={(event) => update(index, { nfce_nome_impressora: event.target.value || undefined })}
                        />
                        <NumberField
                          label="Largura da bobina (mm)"
                          value={terminal.nfce_impressora_largura_bonina}
                          onChange={(v) => update(index, { nfce_impressora_largura_bonina: v })}
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <GroupHeading>Certificado digital</GroupHeading>
                    <div className="mt-2 grid gap-4 sm:grid-cols-2">
                      <TextField
                        label="Caminho do certificado"
                        icon={<ShieldIcon className="h-4 w-4" />}
                        value={terminal.certificate_path ?? ''}
                        onChange={(event) => update(index, { certificate_path: event.target.value || undefined })}
                      />
                      <TextField
                        label="Senha do certificado"
                        icon={<KeyIcon className="h-4 w-4" />}
                        type="password"
                        value={terminal.certificate_password ?? ''}
                        onChange={(event) => update(index, { certificate_password: event.target.value || undefined })}
                      />
                    </div>
                  </div>

                  <div>
                    <GroupHeading>Impressora</GroupHeading>
                    <div className="mt-2">
                      <TextField
                        label="Caminho/porta da impressora"
                        icon={<PrinterIcon className="h-4 w-4" />}
                        value={terminal.printer_path ?? ''}
                        onChange={(event) => update(index, { printer_path: event.target.value || undefined })}
                      />
                    </div>
                  </div>

                  <div>
                    <GroupHeading>Balança</GroupHeading>
                    <p className="mt-1 text-[11px] text-[var(--muted)]">
                      Campos do sistema desktop legado (comunicação serial) - os códigos numéricos vêm de quem
                      configurou o hardware da balança; deixe em branco se este terminal não usa balança.
                    </p>
                    <div className="mt-2 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      <NumberField label="Modelo" value={terminal.balance_model} onChange={(v) => update(index, { balance_model: v })} />
                      <NumberField
                        label="Handshake"
                        value={terminal.balance_hand_shake}
                        onChange={(v) => update(index, { balance_hand_shake: v })}
                      />
                      <NumberField label="Paridade" value={terminal.balance_parity} onChange={(v) => update(index, { balance_parity: v })} />
                      <NumberField label="Stop bits" value={terminal.balance_stop} onChange={(v) => update(index, { balance_stop: v })} />
                      <NumberField label="Data bits" value={terminal.balance_data} onChange={(v) => update(index, { balance_data: v })} />
                      <NumberField label="Baud rate" value={terminal.balance_baud} onChange={(v) => update(index, { balance_baud: v })} />
                      <TextField
                        label="Porta (ex: COM1)"
                        icon={<WrenchIcon className="h-4 w-4" />}
                        value={terminal.balance_path ?? ''}
                        onChange={(event) => update(index, { balance_path: event.target.value || undefined })}
                      />
                    </div>
                  </div>

                  <div>
                    <GroupHeading>TEF PayGo</GroupHeading>
                    <p className="mt-1 text-[11px] text-[var(--muted)]">
                      Também legado do sistema desktop - os códigos numéricos (modelo, transação, pos-printer) vêm
                      de quem configurou a integração TEF; deixe em branco se este terminal não usa TEF.
                    </p>
                    <div className="mt-2 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      <TextField
                        label="CNPJ"
                        icon={<BuildingIcon className="h-4 w-4" />}
                        value={terminal.tef_cnpj ?? ''}
                        onChange={(event) => update(index, { tef_cnpj: event.target.value || undefined })}
                      />
                      <NumberField
                        label="Ponto de captura"
                        value={terminal.tef_ponto_captura}
                        onChange={(v) => update(index, { tef_ponto_captura: v })}
                      />
                      <NumberField label="Modelo" value={terminal.tef_paygo_modelo} onChange={(v) => update(index, { tef_paygo_modelo: v })} />
                      <NumberField
                        label="Transação pendente"
                        value={terminal.tef_paygo_transacao_pendente}
                        onChange={(v) => update(index, { tef_paygo_transacao_pendente: v })}
                      />
                      <NumberField
                        label="Transação inicialização"
                        value={terminal.tef_paygo_transacao_inicializacao}
                        onChange={(v) => update(index, { tef_paygo_transacao_inicializacao: v })}
                      />
                      <NumberField
                        label="Exibição QR-code"
                        value={terminal.tef_paygo_exibicao_qrcode}
                        onChange={(v) => update(index, { tef_paygo_exibicao_qrcode: v })}
                      />
                    </div>

                    <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                      {(
                        [
                          ['tef_paygo_auto_atendimento', 'Auto atendimento'],
                          ['tef_paygo_imprime_via_cliente_reduzida', 'Imprime via cliente reduzida'],
                          ['tef_paygo_confirma_transacao_autonomamente', 'Confirma transação autonomamente'],
                          ['tef_paygo_suporta_desconto', 'Suporta desconto'],
                          ['tef_paygo_suporta_saque', 'Suporta saque'],
                        ] as [keyof CompanyTerminalPayload, string][]
                      ).map(([field, label]) => (
                        <div key={field} className="flex items-center justify-between rounded-xl bg-[var(--page)] px-3.5 py-2.5">
                          <span className="text-[12.5px] font-semibold text-[var(--ink)]">{label}</span>
                          <Toggle
                            checked={Boolean(terminal[field])}
                            onChange={(checked) => update(index, { [field]: checked } as Partial<CompanyTerminalPayload>)}
                          />
                        </div>
                      ))}
                    </div>

                    <div className="mt-3">
                      <GroupHeading>Pos-printer (TEF)</GroupHeading>
                      <div className="mt-2 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        <NumberField
                          label="Modelo"
                          value={terminal.tef_paygo_posprinter_modelo}
                          onChange={(v) => update(index, { tef_paygo_posprinter_modelo: v })}
                        />
                        <NumberField
                          label="Página de código"
                          value={terminal.tef_paygo_posprinter_pagina_de_codigo}
                          onChange={(v) => update(index, { tef_paygo_posprinter_pagina_de_codigo: v })}
                        />
                        <TextField
                          label="Porta"
                          icon={<CreditCardIcon className="h-4 w-4" />}
                          value={terminal.tef_paygo_posprinter_porta ?? ''}
                          onChange={(event) => update(index, { tef_paygo_posprinter_porta: event.target.value || undefined })}
                        />
                        <NumberField
                          label="Colunas"
                          value={terminal.tef_paygo_posprinter_colunas}
                          onChange={(v) => update(index, { tef_paygo_posprinter_colunas: v })}
                        />
                        <NumberField
                          label="Linhas"
                          value={terminal.tef_paygo_posprinter_linhas}
                          onChange={(v) => update(index, { tef_paygo_posprinter_linhas: v })}
                        />
                        <NumberField
                          label="Espaço"
                          value={terminal.tef_paygo_posprinter_espaco}
                          onChange={(v) => update(index, { tef_paygo_posprinter_espaco: v })}
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="flex items-center justify-center gap-2 rounded-xl border border-[var(--red-100)] py-2.5 text-[12.5px] font-bold text-[var(--red-500)] hover:bg-[var(--red-100)]"
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                    Remover terminal
                  </button>
                </div>
              )}
            </div>
          )
        })}

        <button
          type="button"
          onClick={add}
          className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border)] py-2.5 text-[12.5px] font-bold text-[var(--ink-soft)] hover:border-[var(--blue-300)] hover:text-[var(--blue-700)]"
        >
          <PlusIcon className="h-3.5 w-3.5" />
          Adicionar terminal
        </button>

        <p className="flex items-start gap-2 rounded-xl bg-[var(--blue-100)] px-3.5 py-2.5 text-[11.5px] text-[var(--blue-700)]">
          <FileTextIcon className="mt-0.5 h-3.5 w-3.5 flex-none" />
          O PDV web usa hoje nome, ativo e link do servidor local. Os demais campos (NF-e/NFC-e, impressora,
          certificado, balança, TEF) ficam centralizados aqui pra quando o terminal específico precisar de
          numeração, ambiente ou hardware diferente do padrão da empresa.
        </p>
      </div>
    </SectionCard>
  )
}
