import type { NfeRecord } from './nfes'

// Campos da aba "Avançado" da NF-e. A chave é a mesma da coluna em nfes e do
// campo enviado ao provedor fiscal; no formulário tudo é texto (valores em "1234.56").
export const ADVANCED_TEXT_KEYS = [
  'cnpj_transportador',
  'cpf_transportador',
  'nome_transportador',
  'inscricao_estadual_transportador',
  'endereco_transportador',
  'municipio_transportador',
  'veiculo_placa',
  'veiculo_uf',
  'veiculo_rntc',
  'numero_fatura',
  'cnpj_intermediario',
  'id_intermediario',
  'informacoes_adicionais_fisco',
  'nota_empenho_compra',
  'pedido_compra',
  'contrato_compra',
  'uf_local_embarque',
  'local_embarque',
  'local_despacho',
  'cnpj_entrega',
  'cpf_entrega',
  'nome_entrega',
  'logradouro_entrega',
  'numero_entrega',
  'complemento_entrega',
  'bairro_entrega',
  'municipio_entrega',
  'uf_entrega',
  'cep_entrega',
  'telefone_entrega',
  'email_entrega',
  'codigo_municipio_entrega',
] as const

export const ADVANCED_MONEY_KEYS = [
  'valor_troco',
  'pis_valor_retido',
  'cofins_valor_retido',
  'csll_valor_retido',
  'irrf_base_calculo',
  'irrf_valor_retido',
  'prev_social_base_calculo',
  'prev_social_valor_retido',
  'valor_original_fatura',
  'valor_desconto_fatura',
  'valor_liquido_fatura',
] as const

type TextKey = (typeof ADVANCED_TEXT_KEYS)[number]
type MoneyKey = (typeof ADVANCED_MONEY_KEYS)[number]

export type AdvancedState = Record<TextKey | MoneyKey, string> & {
  modalidade_frete: string
  indicador_intermediario: string
  data_entrada_saida: string
  // Chaves de acesso (44 dígitos) das notas referenciadas (devolução, complementar...).
  references: string[]
}

export const NFE_FREIGHT_OPTIONS: { value: string; label: string }[] = [
  { value: '9', label: 'Sem ocorrência de transporte' },
  { value: '0', label: 'Por conta do remetente (CIF)' },
  { value: '1', label: 'Por conta do destinatário (FOB)' },
  { value: '2', label: 'Por conta de terceiros' },
  { value: '3', label: 'Transporte próprio do remetente' },
  { value: '4', label: 'Transporte próprio do destinatário' },
]

export function emptyAdvanced(): AdvancedState {
  const state = { modalidade_frete: '9', indicador_intermediario: '0', data_entrada_saida: '', references: [] } as unknown as AdvancedState
  for (const key of [...ADVANCED_TEXT_KEYS, ...ADVANCED_MONEY_KEYS]) state[key] = ''
  return state
}

function toLocalInput(value?: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

export function advancedFromRecord(nfe: NfeRecord): AdvancedState {
  const state = emptyAdvanced()
  const record = nfe as unknown as Record<string, unknown>
  for (const key of [...ADVANCED_TEXT_KEYS, ...ADVANCED_MONEY_KEYS]) {
    const value = record[key]
    state[key] = value === null || value === undefined ? '' : String(value)
  }
  state.modalidade_frete = nfe.modalidade_frete === null || nfe.modalidade_frete === undefined ? '9' : String(nfe.modalidade_frete)
  state.indicador_intermediario = String(nfe.indicador_intermediario ?? 0)
  state.data_entrada_saida = toLocalInput(nfe.data_entrada_saida)
  state.references = (nfe.notas_referenciadas ?? []).map((reference) => reference.chave_nfe)
  return state
}

// Tudo vai no rascunho, inclusive vazio: o servidor entende vazio como "limpar o campo".
export function advancedToPayload(state: AdvancedState): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  for (const key of ADVANCED_TEXT_KEYS) payload[key] = state[key].trim()
  for (const key of ADVANCED_MONEY_KEYS) payload[key] = state[key] === '' ? '' : Number(state[key])
  payload.modalidade_frete = Number(state.modalidade_frete)
  payload.indicador_intermediario = Number(state.indicador_intermediario)
  payload.data_entrada_saida = state.data_entrada_saida ? new Date(state.data_entrada_saida).toISOString() : ''
  payload.references = state.references.map((key) => ({ chave_nfe: key.replace(/\D/g, '') }))
  return payload
}

// Mensagens do que está errado antes de enviar (o servidor valida de novo).
export function validateAdvanced(state: AdvancedState): string[] {
  const digits = (value: string) => value.replace(/\D/g, '')
  const messages: string[] = []

  if (state.cnpj_transportador && digits(state.cnpj_transportador).length !== 14) {
    messages.push('Transporte: o CNPJ do transportador precisa ter 14 dígitos.')
  }
  if (state.cpf_transportador && digits(state.cpf_transportador).length !== 11) {
    messages.push('Transporte: o CPF do transportador precisa ter 11 dígitos.')
  }
  if ((state.cnpj_transportador || state.cpf_transportador) && !state.nome_transportador.trim()) {
    messages.push('Transporte: preencha o nome do transportador.')
  }
  if (state.veiculo_placa && !state.veiculo_uf) messages.push('Transporte: informe a UF da placa do veículo.')

  const delivery = [
    state.cnpj_entrega,
    state.cpf_entrega,
    state.nome_entrega,
    state.logradouro_entrega,
    state.numero_entrega,
    state.bairro_entrega,
    state.municipio_entrega,
    state.uf_entrega,
    state.cep_entrega,
  ]
  if (delivery.some((value) => value.trim())) {
    if (!state.logradouro_entrega.trim() || !state.numero_entrega.trim() || !state.bairro_entrega.trim()) {
      messages.push('Local de entrega: preencha logradouro, número e bairro.')
    }
    if (!state.municipio_entrega.trim() || !state.uf_entrega || digits(state.cep_entrega).length !== 8) {
      messages.push('Local de entrega: preencha município, UF e CEP.')
    }
    if (digits(state.codigo_municipio_entrega).length !== 7) {
      messages.push('Local de entrega: o código IBGE do município precisa ter 7 dígitos (use "Buscar CEP").')
    }
    if (!digits(state.cnpj_entrega) && !digits(state.cpf_entrega)) {
      messages.push('Local de entrega: informe o CNPJ ou o CPF de quem recebe.')
    }
  }

  if (state.cnpj_intermediario && digits(state.cnpj_intermediario).length !== 14) {
    messages.push('Intermediador: o CNPJ precisa ter 14 dígitos.')
  }
  if (state.indicador_intermediario === '1' && !state.cnpj_intermediario) {
    messages.push('Intermediador: informe o CNPJ do intermediador.')
  }
  if (state.references.some((key) => digits(key).length !== 44)) {
    messages.push('Documentos referenciados: cada chave de acesso precisa ter 44 dígitos.')
  }
  return messages
}
