import { useEffect, useState } from 'react'
import type { ConfigPayload, ConfigRecord } from '../../lib/config'
import { fetchNfeNatureOperations, type NfeNatureOperationRecord } from '../../lib/nfeNatureOperations'
import { SectionCard } from '../../components/SectionCard'
import { TextField } from '../../components/form/TextField'
import { SelectField } from '../../components/form/SelectField'
import { SearchSelectField } from '../../components/form/SearchSelectField'
import { LinkIcon, KeyIcon, TagIcon } from '../../components/icons'
import type { AuthSession, AuthCompany } from '../../lib/auth'

interface FiscalSectionProps {
  value: ConfigPayload
  onChange: (patch: Partial<ConfigPayload>) => void
  config: ConfigRecord | null
  session: AuthSession
  company: AuthCompany
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

export function FiscalSection({ value, onChange, config, session, company }: FiscalSectionProps) {
  const [natureOperationLabel, setNatureOperationLabel] = useState<string | null>(null)
  const [nfceNatureOperationLabel, setNfceNatureOperationLabel] = useState<string | null>(null)

  useEffect(() => {
    setNatureOperationLabel(config?.natureOperation?.description ?? null)
    setNfceNatureOperationLabel(config?.nfce_nature_operation?.description ?? null)
  }, [config])

  return (
    <div className="flex flex-col gap-4">
      <SectionCard title="Módulo de NFe" subtitle="Ativação e credenciais Focus NFe">
        <div className="flex flex-col gap-5">
          <label className="flex items-center gap-2.5">
            <input
              type="checkbox"
              checked={Boolean(value.nfe_module_enabled)}
              onChange={(event) => onChange({ nfe_module_enabled: event.target.checked })}
              className="h-4 w-4 accent-[var(--blue-500)]"
            />
            <span className="text-[13.5px] font-semibold text-[var(--ink)]">Ativar módulo de NFe</span>
          </label>

          {value.nfe_module_enabled && (
            <>
              <SelectField
                label="Provedor de emissão"
                value={value.nfe_provider ?? 'focus'}
                onChange={(event) => onChange({ nfe_provider: event.target.value })}
              >
                <option value="focus">Focus NFe</option>
                <option value="delphi">Servidor próprio</option>
              </SelectField>
              {value.nfe_provider === 'delphi' ? (
                <p className="text-[12px] text-[var(--muted)]">
                  A prévia de DANFE (sem enviar pra SEFAZ) só funciona com o servidor próprio — é a única opção que
                  gera o PDF sem autorizar a nota.
                </p>
              ) : (
                <p className="text-[12px] text-[var(--muted)]">
                  A Focus NFe não expõe prévia de DANFE sem autorização — pra usar o botão "Pré-visualizar" nas
                  Notas Fiscais, troque pra Servidor próprio.
                </p>
              )}

              {value.nfe_provider !== 'delphi' && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    label="Token Focus NFe (produção)"
                    icon={<KeyIcon className="h-4 w-4" />}
                    type="password"
                    value={value.focus_nfe_token_producao ?? ''}
                    onChange={(event) => onChange({ focus_nfe_token_producao: event.target.value })}
                  />
                  <TextField
                    label="Token Focus NFe (homologação)"
                    icon={<KeyIcon className="h-4 w-4" />}
                    type="password"
                    value={value.focus_nfe_token_homologacao ?? ''}
                    onChange={(event) => onChange({ focus_nfe_token_homologacao: event.target.value })}
                  />
                  <TextField
                    label="URL da API (produção)"
                    icon={<LinkIcon className="h-4 w-4" />}
                    placeholder="https://api.focusnfe.com.br"
                    value={value.focus_nfe_api_producao ?? ''}
                    onChange={(event) => onChange({ focus_nfe_api_producao: event.target.value })}
                  />
                  <TextField
                    label="URL da API (homologação)"
                    icon={<LinkIcon className="h-4 w-4" />}
                    placeholder="https://homologacao.focusnfe.com.br"
                    value={value.focus_nfe_api_homologacao ?? ''}
                    onChange={(event) => onChange({ focus_nfe_api_homologacao: event.target.value })}
                  />
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <SelectField
                  label="Ambiente"
                  value={value.nfe_ambiente ?? ''}
                  onChange={(event) =>
                    onChange({ nfe_ambiente: event.target.value === '' ? undefined : Number(event.target.value) })
                  }
                >
                  <option value="">Selecione</option>
                  <option value={0}>Produção</option>
                  <option value={1}>Homologação</option>
                </SelectField>
                <NumberField label="Série" value={value.nfe_serie} onChange={(v) => onChange({ nfe_serie: v })} />
                <NumberField
                  label="Próximo número"
                  value={value.nfe_numero}
                  onChange={(v) => onChange({ nfe_numero: v })}
                />
                <NumberField
                  label="Série (homologação)"
                  value={value.nfe_homologacao_serie}
                  onChange={(v) => onChange({ nfe_homologacao_serie: v })}
                />
                <NumberField
                  label="Próximo número (homologação)"
                  value={value.nfe_homologacao_numero}
                  onChange={(v) => onChange({ nfe_homologacao_numero: v })}
                />
              </div>

              <SearchSelectField
                label="Natureza de operação padrão"
                placeholder="Buscar natureza de operação"
                selectedLabel={natureOperationLabel}
                onSearch={(query) =>
                  fetchNfeNatureOperations(session.token.token, company.id, { search: query, limit: 8 }).then(
                    (res) => res.data
                  )
                }
                getOptionLabel={(item: NfeNatureOperationRecord) => item.description}
                onSelect={(item: NfeNatureOperationRecord) => {
                  setNatureOperationLabel(item.description)
                  onChange({ nfeNatureOperationId: item.id })
                }}
                onClear={() => {
                  setNatureOperationLabel(null)
                  onChange({ nfeNatureOperationId: undefined })
                }}
              />
              {!natureOperationLabel && (
                <p className="flex items-center gap-1 text-[12px] text-[var(--muted)]">
                  <TagIcon className="h-3 w-3" />
                  Nenhuma natureza de operação cadastrada ainda — cadastre em Fiscal → Natureza de Operação.
                </p>
              )}
            </>
          )}
        </div>
      </SectionCard>

      <SectionCard title="NFC-e" subtitle="Nota fiscal de consumidor (venda rápida do PDV) — série, CSC e ambiente">
        {!value.nfe_module_enabled ? (
          <p className="text-[12.5px] text-[var(--muted)]">
            Ative o módulo de NFe acima pra configurar a NFC-e — ela usa o mesmo provedor de emissão e as mesmas
            credenciais.
          </p>
        ) : (
          <div className="flex flex-col gap-5">
            <p className="text-[12px] text-[var(--muted)]">
              A NFC-e usa o mesmo provedor e as mesmas credenciais da NFe, mas com série, numeração e CSC próprios. Pra
              começar testando, deixe o ambiente em <strong>Homologação</strong>.
            </p>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <SelectField
                label="Ambiente"
                value={value.nfce_ambiente ?? ''}
                onChange={(event) =>
                  onChange({ nfce_ambiente: event.target.value === '' ? undefined : Number(event.target.value) })
                }
              >
                <option value="">Selecione</option>
                <option value={0}>Produção</option>
                <option value={1}>Homologação</option>
              </SelectField>
              <NumberField label="Série" value={value.nfce_serie} onChange={(v) => onChange({ nfce_serie: v })} />
              <NumberField
                label="Próximo número"
                value={value.nfce_numero}
                onChange={(v) => onChange({ nfce_numero: v })}
              />
              <NumberField
                label="Série (homologação)"
                value={value.nfce_homologacao_serie}
                onChange={(v) => onChange({ nfce_homologacao_serie: v })}
              />
              <NumberField
                label="Próximo número (homologação)"
                value={value.nfce_homologacao_numero}
                onChange={(v) => onChange({ nfce_homologacao_numero: v })}
              />
              <NumberField
                label="ID do CSC (idToken)"
                value={value.nfce_id_token}
                onChange={(v) => onChange({ nfce_id_token: v })}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="CSC (homologação)"
                icon={<KeyIcon className="h-4 w-4" />}
                type="password"
                autoComplete="new-password"
                value={value.nfce_csc_homologacao ?? ''}
                onChange={(event) => onChange({ nfce_csc_homologacao: event.target.value })}
              />
              <TextField
                label="CSC (produção)"
                icon={<KeyIcon className="h-4 w-4" />}
                type="password"
                autoComplete="new-password"
                value={value.nfce_csc_producao ?? ''}
                onChange={(event) => onChange({ nfce_csc_producao: event.target.value })}
              />
            </div>
            <p className="text-[11.5px] text-[var(--muted)]">
              O CSC e o ID do CSC são gerados no portal da SEFAZ do estado da empresa (um par pra homologação e outro
              pra produção).
            </p>

            <SearchSelectField
              label="Natureza de operação padrão (NFC-e)"
              placeholder="Buscar natureza de operação"
              selectedLabel={nfceNatureOperationLabel}
              onSearch={(query) =>
                fetchNfeNatureOperations(session.token.token, company.id, { search: query, limit: 8 }).then(
                  (res) => res.data
                )
              }
              getOptionLabel={(item: NfeNatureOperationRecord) => item.description}
              onSelect={(item: NfeNatureOperationRecord) => {
                setNfceNatureOperationLabel(item.description)
                onChange({ nfceNatureOperationId: item.id })
              }}
              onClear={() => {
                setNfceNatureOperationLabel(null)
                onChange({ nfceNatureOperationId: undefined })
              }}
            />
          </div>
        )}
      </SectionCard>
    </div>
  )
}
