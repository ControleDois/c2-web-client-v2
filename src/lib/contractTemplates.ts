import { apiGet, apiPost, apiPut, apiDelete } from './api'

export interface ContractTemplateRecord {
  id: string
  code?: number
  internal_code?: number | null
  company_id?: string
  title: string
  target_type: string
  description?: string | null
  html: string
  signature_page: number
  signature_x: number
  signature_y: number
  signature_all_pages: boolean
  // Posição da assinatura da empresa (2º assinante, ver Config.autentique_signer_email)
  company_signature_page?: number
  company_signature_x?: number
  company_signature_y?: number
  company_signature_all_pages?: boolean
  is_active: boolean
  created_at?: string
}

export interface ContractTemplatePayload {
  company_id: string
  internal_code?: number
  title: string
  target_type: string
  description?: string
  html: string
  signature_page: number
  signature_x: number
  signature_y: number
  signature_all_pages: boolean
  company_signature_page?: number
  company_signature_x?: number
  company_signature_y?: number
  company_signature_all_pages?: boolean
  is_active: boolean
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

export const TARGET_TYPE_LABELS: Record<string, string> = {
  protection_vehicle: 'Proteção Veicular',
  vehicle_rental: 'Aluguel de Veículo',
  vehicle_rental_purchase_option: 'Aluguel com Opção de Compra',
  vehicle_sale: 'Venda de Veículo',
  towing_sale: 'Guincho / Cegonha',
  general: 'Geral',
  ti: 'TI',
  support_contract: 'Contrato de Suporte',
  loan: 'Empréstimo',
  glass_order: 'Vidraçaria (pedido)',
}

export const TARGET_TYPE_VARIABLES: Record<string, string[]> = {
  protection_vehicle: [
    '{{protection.name}}',
    '{{protection.document}}',
    '{{protection.email}}',
    '{{protection.license_plate}}',
    '{{protection.brand}}',
    '{{protection.model}}',
    '{{protection.protection_plan.description}}',
    '{{values.protection_value_formatted}}',
    '{{values.tax_value_formatted}}',
    '{{values.contract_value_formatted}}',
    '{{values.birth_formatted}}',
    '{{values.co_participation_percent}}',
  ],
  towing_sale: [
    '{{people.name}}',
    '{{vehicle.license_plate}}',
    '{{vehicle.model}}',
    '{{values.type_label}}',
    '{{values.transport_value_formatted}}',
    '{{values.origin_address}}',
    '{{values.destination_address}}',
    '{{values.deadline_label}}',
  ],
  vehicle_sale: [
    '{{buyer.name}}',
    '{{buyer.document}}',
    '{{vehicle.license_plate}}',
    '{{vehicle.brand}}',
    '{{vehicle.model}}',
    '{{values.sale_value_formatted}}',
    '{{values.down_payment_formatted}}',
    '{{values.installment_count}}',
    '{{values.installment_value_formatted}}',
    '{{#if values.has_guarantor}}…{{/if}}',
  ],
  vehicle_rental: [
    '{{renter.name}}',
    '{{vehicle.license_plate}}',
    '{{values.rental_value_formatted}}',
    '{{values.start_date_formatted}}',
    '{{values.end_date_formatted}}',
    '{{values.security_deposit_formatted}}',
  ],
  vehicle_rental_purchase_option: [
    '{{renter.name}}',
    '{{vehicle.license_plate}}',
    '{{values.rental_value_formatted}}',
    '{{values.start_date_formatted}}',
    '{{values.end_date_formatted}}',
    '{{#if values.has_purchase_option}}…{{/if}}',
  ],
  general: [],
  // TI (SoftwareHouse) não tem venda/entidade própria vinculada ainda, então
  // não há dado dinâmico do cliente pra puxar automaticamente - só as
  // variáveis comuns (empresa, CNPJ, data), como no Geral.
  ti: [],
  loan: [
    '{{contract.id}}',
    '{{contract.date_long}}',
    '{{creditor.name}}',
    '{{creditor.document_label}}',
    '{{debtor.name}}',
    '{{debtor.document_type}}',
    '{{debtor.document}}',
    '{{debtor.birth_label}}',
    '{{debtor.address_line1}}',
    '{{debtor.address_line2}}',
    '{{debtor.address_line3}}',
    '{{debtor.zip_label}}',
    '{{values.principal_formatted}}',
    '{{values.interest_formatted}}',
    '{{values.total_formatted}}',
    '{{values.installments_count}}',
    '{{values.installments_label}}',
    '{{values.payment_summary}}',
    '{{#each installments}}',
    '{{item.number}}',
    '{{item.date_label}}',
    '{{item.amount_formatted}}',
    '{{/each}}',
  ],
  glass_order: [
    '{{client.name}}',
    '{{client.document}}',
    '{{client.address_line}}',
    '{{order.code}}',
    '{{order.reference}}',
    '{{order.work_address}}',
    '{{order.expected_delivery}}',
    '{{values.total_formatted}}',
    '{{values.down_payment_formatted}}',
    '{{#each items}}',
    '{{item.description}}',
    '{{item.measures}}',
    '{{item.quantity}}',
    '{{item.total_formatted}}',
    '{{/each}}',
    '{{#each installments}}',
    '{{item.date_label}}',
    '{{item.amount_formatted}}',
    '{{/each}}',
  ],
  support_contract: [
    '{{people.name}}',
    '{{people.document}}',
    '{{values.title}}',
    '{{values.monthly_value_formatted}}',
    '{{values.billing_day}}',
    '{{values.start_date_formatted}}',
  ],
}

export const COMMON_VARIABLES = ['{{company.name}}', '{{company_people.document}}', '{{today}}', '{{now}}']

export function fetchContractTemplates(
  token: string,
  companyId: string,
  options: { search?: string; targetType?: string; page?: number; limit?: number } = {}
) {
  return apiGet<Paginated<ContractTemplateRecord>>(
    '/contract-template',
    {
      companyId,
      search: options.search,
      targetType: options.targetType,
      page: options.page ? String(options.page) : '1',
      limit: options.limit ? String(options.limit) : '20',
    },
    token
  )
}

export function fetchContractTemplate(token: string, id: string) {
  return apiGet<ContractTemplateRecord>(`/contract-template/${id}`, {}, token)
}

export function createContractTemplate(token: string, payload: ContractTemplatePayload) {
  return apiPost<ContractTemplateRecord>('/contract-template', payload, token)
}

export function updateContractTemplate(token: string, id: string, payload: ContractTemplatePayload) {
  return apiPut<ContractTemplateRecord>(`/contract-template/${id}`, payload, token)
}

export function deleteContractTemplate(token: string, id: string) {
  return apiDelete<void>(`/contract-template/${id}`, token)
}
