import { useState } from 'react'
import {
  NFE_FREIGHT_OPTIONS,
  type AdvancedState,
} from '../lib/nfeAdvanced'
import type { NfeRecord } from '../lib/nfes'
import { BRAZIL_STATES } from '../lib/brazilStates'
import { fetchCepData } from '../lib/cepLookup'
import { formatCep } from '../lib/formatCep'
import { formatCurrency } from '../lib/format'
import { SectionCard } from './SectionCard'
import { TextField } from './form/TextField'
import { MoneyField } from './form/MoneyField'
import { SelectField } from './form/SelectField'
import { PlusIcon, TagIcon, TrashIcon } from './icons'

interface NfeAdvancedSectionsProps {
  value: AdvancedState
  onChange: (patch: Partial<AdvancedState>) => void
  // NF-e já salva (edição): traz os totais calculados pelo servidor.
  saved?: NfeRecord | null
}

const textarea =
  'w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition placeholder:text-[var(--muted)] focus:outline-none focus:ring-[var(--blue-300)]'

function UfSelect({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <SelectField label={label} value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">—</option>
      {BRAZIL_STATES.map((uf) => (
        <option key={uf} value={uf}>
          {uf}
        </option>
      ))}
    </SelectField>
  )
}

export function NfeAdvancedSections({ value, onChange, saved }: NfeAdvancedSectionsProps) {
  const [cepLoading, setCepLoading] = useState(false)
  const [cepMessage, setCepMessage] = useState<string | null>(null)
  const [newReference, setNewReference] = useState('')

  async function lookupDeliveryCep() {
    const digits = value.cep_entrega.replace(/\D/g, '')
    if (digits.length !== 8) return
    setCepLoading(true)
    setCepMessage(null)
    try {
      const result = await fetchCepData(digits)
      onChange({
        logradouro_entrega: result.street || value.logradouro_entrega,
        bairro_entrega: result.district || value.bairro_entrega,
        municipio_entrega: result.city || value.municipio_entrega,
        uf_entrega: result.state || value.uf_entrega,
        codigo_municipio_entrega: result.codeIbge || value.codigo_municipio_entrega,
      })
    } catch {
      setCepMessage('Não foi possível encontrar o CEP.')
    } finally {
      setCepLoading(false)
    }
  }

  function addReference() {
    const key = newReference.replace(/\D/g, '')
    if (!key) return
    onChange({ references: [...value.references, key] })
    setNewReference('')
  }

  const totals: { label: string; value: unknown }[] = saved
    ? [
        { label: 'Total de ICMS', value: saved.icms_valor_total },
        { label: 'Total de ICMS-ST', value: saved.icms_valor_total_st },
        { label: 'ICMS desonerado', value: saved.icms_valor_total_desonerado },
        { label: 'Total do PIS', value: saved.valor_pis },
        { label: 'Total do COFINS', value: saved.valor_cofins },
        { label: 'Total de IPI', value: saved.valor_ipi },
        { label: 'Tributos aproximados', value: saved.valor_total_tributos },
      ]
    : []

  return (
    <>
      <SectionCard title="Transporte" subtitle="Frete, transportador e veículo" defaultCollapsed>
        <div className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Modalidade do frete"
              value={value.modalidade_frete}
              onChange={(event) => onChange({ modalidade_frete: event.target.value })}
            >
              {NFE_FREIGHT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectField>
          </div>
          <div>
            <h4 className="mb-3 text-[12.5px] font-bold text-[var(--ink)]">Transportador</h4>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <TextField label="CNPJ" icon={<TagIcon className="h-4 w-4" />} inputMode="numeric" value={value.cnpj_transportador} onChange={(event) => onChange({ cnpj_transportador: event.target.value })} />
              <TextField label="CPF (se pessoa física)" icon={<TagIcon className="h-4 w-4" />} inputMode="numeric" value={value.cpf_transportador} onChange={(event) => onChange({ cpf_transportador: event.target.value })} />
              <TextField label="Nome / razão social" icon={<TagIcon className="h-4 w-4" />} value={value.nome_transportador} onChange={(event) => onChange({ nome_transportador: event.target.value })} />
              <TextField label="Inscrição estadual" icon={<TagIcon className="h-4 w-4" />} value={value.inscricao_estadual_transportador} onChange={(event) => onChange({ inscricao_estadual_transportador: event.target.value })} />
              <TextField label="Endereço" icon={<TagIcon className="h-4 w-4" />} value={value.endereco_transportador} onChange={(event) => onChange({ endereco_transportador: event.target.value })} />
              <TextField label="Município" icon={<TagIcon className="h-4 w-4" />} value={value.municipio_transportador} onChange={(event) => onChange({ municipio_transportador: event.target.value })} />
            </div>
          </div>
          <div>
            <h4 className="mb-3 text-[12.5px] font-bold text-[var(--ink)]">Veículo</h4>
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField label="Placa" icon={<TagIcon className="h-4 w-4" />} value={value.veiculo_placa} onChange={(event) => onChange({ veiculo_placa: event.target.value.toUpperCase() })} />
              <UfSelect label="UF da placa" value={value.veiculo_uf} onChange={(uf) => onChange({ veiculo_uf: uf })} />
              <TextField label="RNTC" icon={<TagIcon className="h-4 w-4" />} value={value.veiculo_rntc} onChange={(event) => onChange({ veiculo_rntc: event.target.value })} />
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Retenção de impostos" subtitle="Valores retidos na fonte (serviços)" defaultCollapsed>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MoneyField label="PIS retido" icon={<TagIcon className="h-4 w-4" />} value={value.pis_valor_retido} onChange={(event) => onChange({ pis_valor_retido: event.target.value })} />
          <MoneyField label="COFINS retido" icon={<TagIcon className="h-4 w-4" />} value={value.cofins_valor_retido} onChange={(event) => onChange({ cofins_valor_retido: event.target.value })} />
          <MoneyField label="CSLL retido" icon={<TagIcon className="h-4 w-4" />} value={value.csll_valor_retido} onChange={(event) => onChange({ csll_valor_retido: event.target.value })} />
          <div />
          <MoneyField label="Base de cálculo do IRRF" icon={<TagIcon className="h-4 w-4" />} value={value.irrf_base_calculo} onChange={(event) => onChange({ irrf_base_calculo: event.target.value })} />
          <MoneyField label="IRRF retido" icon={<TagIcon className="h-4 w-4" />} value={value.irrf_valor_retido} onChange={(event) => onChange({ irrf_valor_retido: event.target.value })} />
          <MoneyField label="Base da previdência social" icon={<TagIcon className="h-4 w-4" />} value={value.prev_social_base_calculo} onChange={(event) => onChange({ prev_social_base_calculo: event.target.value })} />
          <MoneyField label="Previdência retida" icon={<TagIcon className="h-4 w-4" />} value={value.prev_social_valor_retido} onChange={(event) => onChange({ prev_social_valor_retido: event.target.value })} />
        </div>
      </SectionCard>

      <SectionCard title="Fatura e troco" subtitle="Dados de cobrança impressos na nota" defaultCollapsed>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <TextField label="Número da fatura" icon={<TagIcon className="h-4 w-4" />} value={value.numero_fatura} onChange={(event) => onChange({ numero_fatura: event.target.value })} />
          <MoneyField label="Valor original" icon={<TagIcon className="h-4 w-4" />} value={value.valor_original_fatura} onChange={(event) => onChange({ valor_original_fatura: event.target.value })} />
          <MoneyField label="Desconto da fatura" icon={<TagIcon className="h-4 w-4" />} value={value.valor_desconto_fatura} onChange={(event) => onChange({ valor_desconto_fatura: event.target.value })} />
          <MoneyField label="Valor líquido" icon={<TagIcon className="h-4 w-4" />} value={value.valor_liquido_fatura} onChange={(event) => onChange({ valor_liquido_fatura: event.target.value })} />
          <MoneyField label="Troco" icon={<TagIcon className="h-4 w-4" />} value={value.valor_troco} onChange={(event) => onChange({ valor_troco: event.target.value })} />
        </div>
      </SectionCard>

      <SectionCard title="Data e hora" subtitle="Saída ou entrada da mercadoria (a emissão é a data do envio)" defaultCollapsed>
        <label className="flex max-w-xs flex-col gap-1.5">
          <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Data e hora de saída</span>
          <input
            type="datetime-local"
            value={value.data_entrada_saida}
            onChange={(event) => onChange({ data_entrada_saida: event.target.value })}
            className={textarea}
          />
        </label>
      </SectionCard>

      <SectionCard title="Entrega em outro endereço" subtitle="Quando a mercadoria vai para um local diferente do endereço do cliente" defaultCollapsed>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <TextField label="CNPJ de quem recebe" icon={<TagIcon className="h-4 w-4" />} inputMode="numeric" value={value.cnpj_entrega} onChange={(event) => onChange({ cnpj_entrega: event.target.value })} />
          <TextField label="CPF de quem recebe" icon={<TagIcon className="h-4 w-4" />} inputMode="numeric" value={value.cpf_entrega} onChange={(event) => onChange({ cpf_entrega: event.target.value })} />
          <TextField label="Nome" icon={<TagIcon className="h-4 w-4" />} value={value.nome_entrega} onChange={(event) => onChange({ nome_entrega: event.target.value })} />
          <div>
            <TextField
              label="CEP"
              icon={<TagIcon className="h-4 w-4" />}
              placeholder="00000-000"
              value={value.cep_entrega}
              onChange={(event) => onChange({ cep_entrega: formatCep(event.target.value) })}
              action={
                value.cep_entrega.replace(/\D/g, '').length === 8 ? (
                  <button type="button" onClick={lookupDeliveryCep} disabled={cepLoading} className="text-[12px] font-semibold text-[var(--blue-700)] hover:underline disabled:opacity-60">
                    {cepLoading ? '…' : 'Buscar CEP'}
                  </button>
                ) : undefined
              }
            />
            {cepMessage && <p className="mt-1.5 text-[12px] text-[var(--red-500)]">{cepMessage}</p>}
          </div>
          <TextField label="Logradouro" icon={<TagIcon className="h-4 w-4" />} value={value.logradouro_entrega} onChange={(event) => onChange({ logradouro_entrega: event.target.value })} />
          <TextField label="Número" icon={<TagIcon className="h-4 w-4" />} value={value.numero_entrega} onChange={(event) => onChange({ numero_entrega: event.target.value })} />
          <TextField label="Complemento" icon={<TagIcon className="h-4 w-4" />} value={value.complemento_entrega} onChange={(event) => onChange({ complemento_entrega: event.target.value })} />
          <TextField label="Bairro" icon={<TagIcon className="h-4 w-4" />} value={value.bairro_entrega} onChange={(event) => onChange({ bairro_entrega: event.target.value })} />
          <TextField label="Município" icon={<TagIcon className="h-4 w-4" />} value={value.municipio_entrega} onChange={(event) => onChange({ municipio_entrega: event.target.value })} />
          <UfSelect label="UF" value={value.uf_entrega} onChange={(uf) => onChange({ uf_entrega: uf })} />
          <TextField label="Código IBGE do município" icon={<TagIcon className="h-4 w-4" />} inputMode="numeric" value={value.codigo_municipio_entrega} onChange={(event) => onChange({ codigo_municipio_entrega: event.target.value.replace(/\D/g, '').slice(0, 7) })} />
          <TextField label="Telefone" icon={<TagIcon className="h-4 w-4" />} value={value.telefone_entrega} onChange={(event) => onChange({ telefone_entrega: event.target.value })} />
          <TextField label="E-mail" icon={<TagIcon className="h-4 w-4" />} type="email" value={value.email_entrega} onChange={(event) => onChange({ email_entrega: event.target.value })} />
        </div>
      </SectionCard>

      <SectionCard title="Intermediador" subtitle="Venda por marketplace ou plataforma" defaultCollapsed>
        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField
            label="Indicador de intermediador"
            value={value.indicador_intermediario}
            onChange={(event) => onChange({ indicador_intermediario: event.target.value })}
          >
            <option value="0">Operação sem intermediador</option>
            <option value="1">Operação com intermediador (marketplace)</option>
          </SelectField>
          {value.indicador_intermediario === '1' && (
            <>
              <TextField label="CNPJ do intermediador" icon={<TagIcon className="h-4 w-4" />} inputMode="numeric" value={value.cnpj_intermediario} onChange={(event) => onChange({ cnpj_intermediario: event.target.value })} />
              <TextField label="Identificação no intermediador" icon={<TagIcon className="h-4 w-4" />} value={value.id_intermediario} onChange={(event) => onChange({ id_intermediario: event.target.value })} />
            </>
          )}
        </div>
      </SectionCard>

      <SectionCard title="Documentos referenciados" subtitle="Chaves de acesso de notas relacionadas (devolução, complementar, ajuste)" defaultCollapsed>
        <div className="flex flex-col gap-3">
          {value.references.map((key, index) => (
            <div key={`${key}-${index}`} className="flex items-center gap-2 rounded-xl bg-[var(--page)] px-3.5 py-2.5">
              <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-[var(--ink)]">{key}</span>
              <button
                type="button"
                onClick={() => onChange({ references: value.references.filter((_, itemIndex) => itemIndex !== index) })}
                aria-label="Remover chave"
                className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--red-100)] hover:text-[var(--red-500)]"
              >
                <TrashIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[280px] flex-1">
              <TextField
                label="Chave de acesso (44 dígitos)"
                icon={<TagIcon className="h-4 w-4" />}
                inputMode="numeric"
                value={newReference}
                onChange={(event) => setNewReference(event.target.value.replace(/\D/g, '').slice(0, 44))}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    addReference()
                  }
                }}
              />
            </div>
            <button
              type="button"
              onClick={addReference}
              disabled={newReference.length !== 44}
              className="mb-px flex items-center gap-1.5 rounded-xl border border-[var(--border)] px-4 py-2.5 text-[13px] font-bold text-[var(--ink-soft)] hover:text-[var(--ink)] disabled:opacity-50"
            >
              <PlusIcon className="h-4 w-4" />
              Adicionar
            </button>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Compras e exportação" subtitle="Empenho, pedido, contrato e local de embarque" defaultCollapsed>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <TextField label="Nota de empenho" icon={<TagIcon className="h-4 w-4" />} value={value.nota_empenho_compra} onChange={(event) => onChange({ nota_empenho_compra: event.target.value })} />
          <TextField label="Pedido" icon={<TagIcon className="h-4 w-4" />} value={value.pedido_compra} onChange={(event) => onChange({ pedido_compra: event.target.value })} />
          <TextField label="Contrato" icon={<TagIcon className="h-4 w-4" />} value={value.contrato_compra} onChange={(event) => onChange({ contrato_compra: event.target.value })} />
          <UfSelect label="UF de embarque" value={value.uf_local_embarque} onChange={(uf) => onChange({ uf_local_embarque: uf })} />
          <TextField label="Local de embarque" icon={<TagIcon className="h-4 w-4" />} value={value.local_embarque} onChange={(event) => onChange({ local_embarque: event.target.value })} />
          <TextField label="Local de despacho" icon={<TagIcon className="h-4 w-4" />} value={value.local_despacho} onChange={(event) => onChange({ local_despacho: event.target.value })} />
        </div>
      </SectionCard>

      <SectionCard title="Informações adicionais de interesse do fisco" defaultCollapsed>
        <textarea
          value={value.informacoes_adicionais_fisco}
          onChange={(event) => onChange({ informacoes_adicionais_fisco: event.target.value })}
          rows={3}
          className={textarea}
          placeholder="Texto livre dirigido ao fisco (raramente necessário)"
        />
      </SectionCard>

      {saved && (
        <SectionCard title="Totais calculados" subtitle="Calculados pelo sistema a partir dos produtos — não editáveis" defaultCollapsed>
          <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-4">
            {totals.map((item) => (
              <div key={item.label}>
                <p className="text-[11.5px] font-semibold text-[var(--muted)]">{item.label}</p>
                <p className="text-[14px] font-medium text-[var(--ink)]">{formatCurrency(Number(item.value) || 0)}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </>
  )
}
