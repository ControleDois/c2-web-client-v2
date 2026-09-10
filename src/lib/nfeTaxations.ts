import { apiGet, apiPost, apiPut, apiDelete } from './api'

// Os dois perfis (Revenda / Consumidor Final) têm exatamente os mesmos
// campos fiscais — confirmado direto nos models do backend
// (NfeTaxationRuleResale/NfeTaxationRuleFinalConsumer).
export interface NfeTaxationRuleProfile {
  icms_situacao_tributaria?: string | null
  icms_adiciona_frete?: boolean
  icms_adiciona_seguro?: boolean
  icms_adiciona_ipi?: boolean
  icms_adiciona_outras_despesas?: boolean
  icms_modalidade_base_calculo?: number | null
  icms_reducao_base_calculo?: number | null
  icms_aliquota?: number | null
  icms_percentual_diferimento?: number | null
  icms_modalidade_base_calculo_st?: number | null
  icms_margem_valor_adicionado_st?: number | null
  icms_reducao_base_calculo_st?: number | null
  icms_aliquota_st?: number | null
  pis_adiciona_frete?: boolean
  pis_adiciona_seguro?: boolean
  pis_adiciona_ipi?: boolean
  pis_adiciona_outras_despesas?: boolean
  pis_situacao_tributaria?: string | null
  pis_aliquota_porcentual?: number | null
  cofins_adiciona_frete?: boolean
  cofins_adiciona_seguro?: boolean
  cofins_adiciona_ipi?: boolean
  cofins_adiciona_outras_despesas?: boolean
  cofins_situacao_tributaria?: string | null
  cofins_aliquota_porcentual?: number | null
  ipi_adiciona_frete?: boolean
  ipi_adiciona_seguro?: boolean
  ipi_adiciona_outras_despesas?: boolean
  ipi_situacao_tributaria?: string | null
  ipi_aliquota?: number | null
  informacoes_nfe?: string | null
  informacoes_ibpt?: boolean
}

// Listas oficiais de CST/CSOSN e modalidades de base de cálculo — mesmas
// opções usadas no formulário antigo (Angular), pra manter o cadastro
// consistente com o que já foi ensinado ao usuário.
export const NFE_ICMS_SITUACAO_OPTIONS: { value: string; label: string }[] = [
  { value: '00', label: '00 - Tributada integralmente' },
  { value: '10', label: '10 - Tribut. com ICMS ST' },
  { value: '20', label: '20 - Redução de base' },
  { value: '30', label: '30 - Isenta/não tributada com ST' },
  { value: '40', label: '40 - Isenta' },
  { value: '41', label: '41 - Não tributada' },
  { value: '50', label: '50 - Suspensão' },
  { value: '51', label: '51 - Diferimento' },
  { value: '60', label: '60 - ICMS cobrado anteriormente' },
  { value: '70', label: '70 - Redução de base com ST' },
  { value: '90', label: '90 - Outras' },
  { value: '101', label: '101 - Simples com crédito' },
  { value: '102', label: '102 - Simples sem crédito' },
  { value: '201', label: '201 - Simples com crédito e ST' },
  { value: '202', label: '202 - Simples sem crédito e ST' },
  { value: '400', label: '400 - Não tributada pelo Simples' },
  { value: '500', label: '500 - ICMS ST/antecipação' },
  { value: '900', label: '900 - Outras Simples' },
]

export const NFE_ICMS_BASE_MODE_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: '0 - Margem de valor agregado' },
  { value: 1, label: '1 - Pauta' },
  { value: 2, label: '2 - Preço tabelado máximo' },
  { value: 3, label: '3 - Valor da operação' },
]

export const NFE_ICMS_ST_BASE_MODE_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: '0 - Preço tabelado ou máximo sugerido' },
  { value: 1, label: '1 - Lista negativa' },
  { value: 2, label: '2 - Lista positiva' },
  { value: 3, label: '3 - Lista neutra' },
  { value: 4, label: '4 - Margem de valor agregado' },
  { value: 5, label: '5 - Pauta' },
  { value: 6, label: '6 - Valor da operação' },
]

export const NFE_PIS_COFINS_SITUACAO_OPTIONS: { value: string; label: string }[] = [
  { value: '01', label: '01 - Tributável alíquota normal' },
  { value: '02', label: '02 - Tributável alíquota diferenciada' },
  { value: '03', label: '03 - Tributável por quantidade' },
  { value: '04', label: '04 - Monofásica alíquota zero' },
  { value: '05', label: '05 - Substituição tributária' },
  { value: '06', label: '06 - Alíquota zero' },
  { value: '07', label: '07 - Isenta' },
  { value: '08', label: '08 - Sem incidência' },
  { value: '09', label: '09 - Suspensão' },
  { value: '49', label: '49 - Outras saídas' },
  { value: '98', label: '98 - Outras entradas' },
  { value: '99', label: '99 - Outras operações' },
]

export const NFE_IPI_SITUACAO_OPTIONS: { value: string; label: string }[] = [
  { value: '50', label: '50 - Saída tributada' },
  { value: '51', label: '51 - Saída tributada alíquota zero' },
  { value: '52', label: '52 - Saída isenta' },
  { value: '53', label: '53 - Saída não tributada' },
  { value: '54', label: '54 - Saída imune' },
  { value: '55', label: '55 - Saída com suspensão' },
  { value: '99', label: '99 - Outras saídas' },
]

export const NFE_ALL_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]

export function emptyTaxationRuleProfile(): NfeTaxationRuleProfile {
  return {
    icms_situacao_tributaria: '',
    icms_adiciona_frete: false,
    icms_adiciona_seguro: false,
    icms_adiciona_ipi: false,
    icms_adiciona_outras_despesas: false,
    icms_modalidade_base_calculo: undefined,
    icms_reducao_base_calculo: undefined,
    icms_aliquota: undefined,
    icms_percentual_diferimento: undefined,
    icms_modalidade_base_calculo_st: undefined,
    icms_margem_valor_adicionado_st: undefined,
    icms_reducao_base_calculo_st: undefined,
    icms_aliquota_st: undefined,
    pis_adiciona_frete: false,
    pis_adiciona_seguro: false,
    pis_adiciona_ipi: false,
    pis_adiciona_outras_despesas: false,
    pis_situacao_tributaria: '',
    pis_aliquota_porcentual: undefined,
    cofins_adiciona_frete: false,
    cofins_adiciona_seguro: false,
    cofins_adiciona_ipi: false,
    cofins_adiciona_outras_despesas: false,
    cofins_situacao_tributaria: '',
    cofins_aliquota_porcentual: undefined,
    ipi_adiciona_frete: false,
    ipi_adiciona_seguro: false,
    ipi_adiciona_outras_despesas: false,
    ipi_situacao_tributaria: '',
    ipi_aliquota: undefined,
    informacoes_nfe: '',
    informacoes_ibpt: false,
  }
}

export interface NfeTaxationRecord {
  id: string
  code?: number
  name: string
}

export interface NfeTaxationPayload {
  company_id: string
  name: string
}

export interface NfeTaxationRuleRecord {
  id: string
  nfe_taxation_id: string
  states?: string[] | null
  nfeTaxationRulesResale?: NfeTaxationRuleProfile | null
  nfeTaxationRulesFinalConsumer?: NfeTaxationRuleProfile | null
}

export interface NfeTaxationRulePayload {
  nfe_taxation_id: string
  states?: string[]
  nfeTaxationRulesResale: NfeTaxationRuleProfile
  nfeTaxationRulesFinalConsumer: NfeTaxationRuleProfile
}

interface Paginated<T> {
  data: T[]
  meta?: {
    total: number
    per_page: number
    current_page: number
    last_page: number
  }
}

export function fetchNfeTaxations(
  token: string,
  companyId: string,
  options: { search?: string; page?: number; limit?: number } = {}
) {
  return apiGet<Paginated<NfeTaxationRecord>>(
    '/nfe-taxation',
    {
      companyId,
      search: options.search,
      page: options.page ? String(options.page) : '1',
      limit: options.limit ? String(options.limit) : '10',
    },
    token
  )
}

export function fetchNfeTaxation(token: string, id: string) {
  return apiGet<NfeTaxationRecord>(`/nfe-taxation/${id}`, {}, token)
}

export function createNfeTaxation(token: string, payload: NfeTaxationPayload) {
  return apiPost<NfeTaxationRecord>('/nfe-taxation', payload, token)
}

export function updateNfeTaxation(token: string, id: string, payload: NfeTaxationPayload) {
  return apiPut<NfeTaxationRecord>(`/nfe-taxation/${id}`, payload, token)
}

export function deleteNfeTaxation(token: string, id: string) {
  return apiDelete<void>(`/nfe-taxation/${id}`, token)
}

export function fetchNfeTaxationRules(token: string, taxationId: string) {
  return apiGet<NfeTaxationRuleRecord[]>('/nfe-taxation-rule', { taxationId }, token)
}

export function createNfeTaxationRule(token: string, payload: NfeTaxationRulePayload) {
  return apiPost<NfeTaxationRuleRecord>('/nfe-taxation-rule', payload, token)
}

export function updateNfeTaxationRule(token: string, id: string, payload: NfeTaxationRulePayload) {
  return apiPut<NfeTaxationRuleRecord>(`/nfe-taxation-rule/${id}`, payload, token)
}

export function deleteNfeTaxationRule(token: string, id: string) {
  return apiDelete<void>(`/nfe-taxation-rule/${id}`, token)
}
