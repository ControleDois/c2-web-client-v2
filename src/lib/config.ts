import { apiGet, apiPutForm, apiPost } from './api'

export interface ProtectionTrackerUser {
  id?: string
  user_id: string
  name: string
  phone?: string
  email?: string
}

export interface BillingWhatsappRule {
  type: 'before' | 'overdue'
  days: number
  active: boolean
}

export interface ShopOpeningHour {
  weekday: number
  enabled: boolean
  opens: string
  closes: string
}

export interface ShopRecord {
  id: string
  linkUrl?: string | null
  bannerUrl?: string | null
  colorDefault?: string | null
  isActive?: boolean
  acceptingOrders?: boolean
  deliveryFee?: number | null
  minimumOrderValue?: number | null
  deliveryRadiusKm?: number | null
  estimatedDeliveryMinutes?: number | null
  openingHours?: ShopOpeningHour[] | null
}

export interface ConfigRecord {
  id: string
  companyId: string

  // Conf. de Venda
  sale_people_default_id?: string | null
  sale_category_default_id?: string | null
  sale_bank_account_default_id?: string | null
  sale_people_default?: { id: string; name: string } | null
  sale_category_default?: { id: string; name: string } | null
  sale_bank_account_default?: { id: string; name: string } | null
  central_box_active?: number | null
  central_box_payment_methods?: string | null

  // Vistorias
  vehicle_inspection_detailed_required?: boolean

  // Gestão de Compras
  purchase_management_enabled?: boolean

  // Cobranças — regras genéricas de multa/juros/desconto (movidas da aba Vendas)
  multa_modalidade?: number | null
  multa_valor?: number | null
  juros_modalidade?: number | null
  juros_valor?: number | null
  desconto_valor?: number | null
  desconto_dias_antecipacao?: number | null

  // Proteção Veicular
  protection_cancel_tracker_task_enabled?: boolean
  protection_cancel_tracker_task_board_id?: string | null
  protection_cancel_tracker_task_due_days?: number | null
  protection_cancel_tracker_task_send_whatsapp?: boolean
  protection_cancel_tracker_task_whatsapp_id?: string | null
  protection_cancel_tracker_task_users?: ProtectionTrackerUser[] | null
  protection_cancel_tracker_task_message?: string | null
  protection_cancel_tracker_task_board?: { id: string; title: string } | null
  protection_cancel_tracker_task_whatsapp?: { id: string; name: string } | null

  // Assinatura Digital
  autentique_api_url?: string | null
  autentique_api_token?: string | null
  autentique_folder_id?: string | null
  autentique_pdf_converter_url?: string | null
  autentique_webhook_secret?: string | null

  // Sicredi Pix
  sicredi_chave_pix?: string | null
  sicredi_client_id?: string | null
  sicredi_client_secret?: string | null
  sicredi_cert_file_name?: string | null
  sicredi_key_file_name?: string | null
  sicredi_pix_validade_apos_vencimento?: number | null
  sicredi_pix_multa_modalidade?: number | null
  sicredi_pix_multa_valor?: number | null
  sicredi_pix_juros_modalidade?: number | null
  sicredi_pix_juros_valor?: number | null
  sicredi_pix_desconto_valor?: number | null
  sicredi_pix_desconto_dias_antecipacao?: number | null

  // Sicredi Boleto
  sicredi_boleto_username?: string | null
  sicredi_boleto_x_api_key?: string | null
  sicredi_boleto_password?: string | null
  sicredi_boleto_cooperativa?: string | null
  sicredi_boleto_posto?: string | null
  sicredi_boleto_codigo_beneficiario?: string | null
  sicredi_boleto_tipo_cobranca?: string | null
  sicredi_boleto_especie_documento?: string | null
  sicredi_boleto_negativar_protesto?: string | null
  sicredi_boleto_dias_protesto_auto?: number | null
  sicredi_boleto_dias_negativacao_auto?: number | null
  sicredi_boleto_validade_apos_vencimento?: number | null
  sicredi_boleto_tipo_juros?: string | null
  sicredi_boleto_juros?: number | null
  sicredi_boleto_tipo_juros_percentual?: string | null
  sicredi_boleto_tipo_multa?: string | null
  sicredi_boleto_multa?: number | null
  sicredi_boleto_tipo_desconto?: string | null
  sicredi_boleto_valor_desconto1?: number | null
  sicredi_boleto_dias_desconto1?: number | null
  sicredi_boleto_valor_desconto2?: number | null
  sicredi_boleto_dias_desconto2?: number | null
  sicredi_boleto_valor_desconto3?: number | null
  sicredi_boleto_dias_desconto3?: number | null
  sicredi_boleto_informativo1?: string | null
  sicredi_boleto_informativo2?: string | null
  sicredi_boleto_informativo3?: string | null
  sicredi_boleto_informativo4?: string | null
  sicredi_boleto_informativo5?: string | null
  sicredi_boleto_mensagem1?: string | null
  sicredi_boleto_mensagem2?: string | null
  sicredi_boleto_mensagem3?: string | null
  sicredi_boleto_mensagem4?: string | null

  // Cobranças
  billing_whatsapp_enabled?: boolean
  billing_whatsapp_ai_mode?: boolean
  billing_whatsapp_start_time?: string | null
  billing_whatsapp_min_interval_minutes?: number | null
  billing_whatsapp_max_interval_minutes?: number | null
  billing_whatsapp_customer_area_url?: string | null
  billing_whatsapp_rules?: BillingWhatsappRule[] | null
  billing_whatsapp_message_before?: string | null
  billing_whatsapp_message_overdue?: string | null

  // Empréstimo
  loan_points_per_payoff?: number | null

  // Loja Online (leitura — vem via preload company.shop no GET /config)
  company?: { system_type?: number; shop?: ShopRecord | null } | null
}

export interface ShopPayload {
  link_url: string
  color_default?: string
  is_active?: boolean
  accepting_orders?: boolean
  delivery_fee?: number
  minimum_order_value?: number
  delivery_radius_km?: number
  estimated_delivery_minutes?: number
  opening_hours?: ShopOpeningHour[]
  categories?: string[]
  banner_file?: File
}

export interface ConfigPayload {
  companyId: string

  sale_people_default_id?: string
  sale_category_default_id?: string
  sale_bank_account_default_id?: string
  central_box_active?: number
  central_box_payment_methods?: number[]

  vehicle_inspection_detailed_required?: boolean

  purchase_management_enabled?: boolean

  multa_modalidade?: number
  multa_valor?: number
  juros_modalidade?: number
  juros_valor?: number
  desconto_valor?: number
  desconto_dias_antecipacao?: number

  protection_cancel_tracker_task_enabled?: boolean
  protection_cancel_tracker_task_board_id?: string
  protection_cancel_tracker_task_due_days?: number
  protection_cancel_tracker_task_send_whatsapp?: boolean
  protection_cancel_tracker_task_whatsapp_id?: string
  protection_cancel_tracker_task_users?: ProtectionTrackerUser[]
  protection_cancel_tracker_task_message?: string

  autentique_api_url?: string
  autentique_api_token?: string
  autentique_folder_id?: string
  autentique_pdf_converter_url?: string
  autentique_webhook_secret?: string

  sicredi_chave_pix?: string
  sicredi_client_id?: string
  sicredi_client_secret?: string
  sicredi_pix_validade_apos_vencimento?: number
  sicredi_pix_multa_modalidade?: number
  sicredi_pix_multa_valor?: number
  sicredi_pix_juros_modalidade?: number
  sicredi_pix_juros_valor?: number
  sicredi_pix_desconto_valor?: number
  sicredi_pix_desconto_dias_antecipacao?: number

  sicredi_boleto_username?: string
  sicredi_boleto_x_api_key?: string
  sicredi_boleto_password?: string
  sicredi_boleto_cooperativa?: string
  sicredi_boleto_posto?: string
  sicredi_boleto_codigo_beneficiario?: string
  sicredi_boleto_tipo_cobranca?: string
  sicredi_boleto_especie_documento?: string
  sicredi_boleto_negativar_protesto?: string
  sicredi_boleto_dias_protesto_auto?: number
  sicredi_boleto_dias_negativacao_auto?: number
  sicredi_boleto_validade_apos_vencimento?: number
  sicredi_boleto_tipo_juros?: string
  sicredi_boleto_juros?: number
  sicredi_boleto_tipo_juros_percentual?: string
  sicredi_boleto_tipo_multa?: string
  sicredi_boleto_multa?: number
  sicredi_boleto_tipo_desconto?: string
  sicredi_boleto_valor_desconto1?: number
  sicredi_boleto_dias_desconto1?: number
  sicredi_boleto_valor_desconto2?: number
  sicredi_boleto_dias_desconto2?: number
  sicredi_boleto_valor_desconto3?: number
  sicredi_boleto_dias_desconto3?: number
  sicredi_boleto_informativo1?: string
  sicredi_boleto_informativo2?: string
  sicredi_boleto_informativo3?: string
  sicredi_boleto_informativo4?: string
  sicredi_boleto_informativo5?: string
  sicredi_boleto_mensagem1?: string
  sicredi_boleto_mensagem2?: string
  sicredi_boleto_mensagem3?: string
  sicredi_boleto_mensagem4?: string

  billing_whatsapp_enabled?: boolean
  billing_whatsapp_ai_mode?: boolean
  billing_whatsapp_start_time?: string
  billing_whatsapp_min_interval_minutes?: number
  billing_whatsapp_max_interval_minutes?: number
  billing_whatsapp_customer_area_url?: string
  billing_whatsapp_rules?: BillingWhatsappRule[]
  billing_whatsapp_message_before?: string
  billing_whatsapp_message_overdue?: string

  loan_points_per_payoff?: number

  shop?: ShopPayload
  sicredi_cert_file?: File
  sicredi_key_file?: File
}

export const SICREDI_BOLETO_TIPO_COBRANCA_OPTIONS: { label: string; value: string }[] = [
  { label: 'Normal', value: 'NORMAL' },
  { label: 'Híbrido', value: 'HIBRIDO' },
]

export const SICREDI_BOLETO_ESPECIE_DOCUMENTO_OPTIONS: { label: string; value: string }[] = [
  { label: 'Duplicata Mercantil Indicação', value: 'DUPLICATA_MERCANTIL_INDICACAO' },
  { label: 'Duplicata Rural', value: 'DUPLICATA_RURAL' },
  { label: 'Nota Promissória', value: 'NOTA_PROMISSORIA' },
  { label: 'Nota Promissória Rural', value: 'NOTA_PROMISSORIA_RURAL' },
  { label: 'Nota de Seguros', value: 'NOTA_SEGUROS' },
  { label: 'Recibo', value: 'RECIBO' },
  { label: 'Letra de Câmbio', value: 'LETRA_CAMBIO' },
  { label: 'Nota de Débito', value: 'NOTA_DEBITO' },
  { label: 'Duplicata de Serviço Indicação', value: 'DUPLICATA_SERVICO_INDICACAO' },
  { label: 'Outros', value: 'OUTROS' },
  { label: 'Boleto Proposta', value: 'BOLETO_PROPOSTA' },
  { label: 'Cartão de Crédito', value: 'CARTAO_CREDITO' },
  { label: 'Boleto Depósito', value: 'BOLETO_DEPOSITO' },
]

export const SICREDI_BOLETO_NEGATIVAR_PROTESTO_OPTIONS: { label: string; value: string }[] = [
  { label: 'Nada fazer', value: '0' },
  { label: 'Negativar', value: '1' },
  { label: 'Protestar', value: '2' },
]

export const SICREDI_BOLETO_TIPO_DESCONTO_OPTIONS: { label: string; value: string }[] = [
  { label: 'R$ (valor fixo)', value: 'VALOR' },
  { label: '% (percentual)', value: 'PERCENTUAL' },
]

export const SICREDI_BOLETO_TIPO_JUROS_PERCENTUAL_OPTIONS: { label: string; value: string }[] = [
  { label: 'Diário', value: 'DIARIO' },
  { label: 'Mensal', value: 'MENSAL' },
]

export const MULTA_MODALIDADE_OPTIONS: { label: string; value: number }[] = [
  { label: 'Valor Fixo (R$)', value: 1 },
  { label: 'Percentual (%)', value: 2 },
]

export const JUROS_MODALIDADE_OPTIONS: { label: string; value: number }[] = [
  { label: 'Valor Fixo Diário (R$)', value: 1 },
  { label: 'Percentual Mensal (%)', value: 2 },
  { label: 'Percentual Anual (%)', value: 3 },
]

export function parseCentralBoxPaymentMethods(raw?: string | null): number[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(Number) : []
  } catch {
    return []
  }
}

export function fetchConfig(token: string, companyId: string) {
  return apiGet<ConfigRecord>('/config', { companyId }, token)
}

function appendScalar(form: FormData, key: string, value: unknown) {
  if (value === undefined || value === null || value === '') return
  form.append(key, String(value))
}

function buildConfigForm(payload: ConfigPayload): FormData {
  const form = new FormData()

  const { shop, sicredi_cert_file: sicrediCertFile, sicredi_key_file: sicrediKeyFile, ...scalars } = payload

  for (const [key, value] of Object.entries(scalars)) {
    if (
      key === 'protection_cancel_tracker_task_users' ||
      key === 'billing_whatsapp_rules' ||
      key === 'central_box_payment_methods'
    ) {
      if (value !== undefined) form.append(key, JSON.stringify(value))
      continue
    }
    if (typeof value === 'boolean') {
      form.append(key, value ? '1' : '0')
      continue
    }
    appendScalar(form, key, value)
  }

  if (shop) {
    appendScalar(form, 'shop[link_url]', shop.link_url)
    appendScalar(form, 'shop[color_default]', shop.color_default)
    if (shop.is_active !== undefined) form.append('shop[is_active]', shop.is_active ? 'true' : 'false')
    if (shop.accepting_orders !== undefined) {
      form.append('shop[accepting_orders]', shop.accepting_orders ? 'true' : 'false')
    }
    appendScalar(form, 'shop[delivery_fee]', shop.delivery_fee)
    appendScalar(form, 'shop[minimum_order_value]', shop.minimum_order_value)
    appendScalar(form, 'shop[delivery_radius_km]', shop.delivery_radius_km)
    appendScalar(form, 'shop[estimated_delivery_minutes]', shop.estimated_delivery_minutes)
    if (shop.opening_hours) form.append('shop[opening_hours]', JSON.stringify(shop.opening_hours))
    if (shop.categories) form.append('shop[categories]', JSON.stringify(shop.categories))
    if (shop.banner_file) form.append('shop.banner_file', shop.banner_file)
  }

  if (sicrediCertFile) form.append('sicredi_cert_file', sicrediCertFile)
  if (sicrediKeyFile) form.append('sicredi_key_file', sicrediKeyFile)

  return form
}

export function updateConfig(token: string, id: string, payload: ConfigPayload) {
  return apiPutForm<ConfigRecord>(`/config/${id}`, buildConfigForm(payload), token)
}

export interface SicrediWebhookResult {
  url?: string
  eventos?: string[]
  nome?: string
  email?: string
  telefone?: string
  [key: string]: unknown
}

export function consultarWebhookPixSicredi(token: string, companyId: string) {
  return apiPost<SicrediWebhookResult>('/config/consultar-webhook-pix-sicredi', { companyId }, token)
}

export function configurarWebhookPixSicredi(token: string, companyId: string, body: Record<string, unknown>) {
  return apiPost<SicrediWebhookResult>('/config/configurar-webhook-pix-sicredi', { companyId, ...body }, token)
}

export function consultarWebhookBoletoSicredi(token: string, companyId: string) {
  return apiPost<SicrediWebhookResult>('/config/consultar-webhook-boleto-sicredi', { companyId }, token)
}

export function criarWebhookBoletoSicredi(token: string, companyId: string, body: Record<string, unknown>) {
  return apiPost<SicrediWebhookResult>('/config/criar-webhook-boleto-sicredi', { companyId, ...body }, token)
}

export function atualizarWebhookBoletoSicredi(
  token: string,
  companyId: string,
  webhookId: string,
  body: Record<string, unknown>
) {
  return apiPost<SicrediWebhookResult>(`/config/atualizar-webhook-boleto-sicredi/${webhookId}`, { companyId, ...body }, token)
}
