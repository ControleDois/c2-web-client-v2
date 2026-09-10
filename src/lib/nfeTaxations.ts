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
