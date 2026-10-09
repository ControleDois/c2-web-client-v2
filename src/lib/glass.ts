import { apiGet, apiPost, apiPostForm, apiPut, apiDelete } from './api'
import type { SendTimeline, SignatureEvidence } from './supportContracts'

export interface Paginated<T> {
  data: T[]
  meta?: { total: number; per_page: number; current_page: number; last_page: number }
}

export const GLASS_KINDS = ['comum', 'temperado', 'laminado', 'espelho', 'aramado', 'insulado', 'outro']

export const GLASS_CATEGORIES = [
  'Janela',
  'Porta',
  'Box',
  'Guarda-corpo',
  'Espelho',
  'Cobertura',
  'Portão',
  'Persiana',
  'Divisória',
  'Outros',
]

export const GLASS_COMPONENT_MODES: { value: GlassComponent['mode']; label: string }[] = [
  { value: 'fixed', label: 'Por peça' },
  { value: 'per_m2', label: 'Por m²' },
  { value: 'per_perimeter', label: 'Por metro de perímetro' },
]

export type GlassComponentKind = 'free' | 'profile' | 'accessory'

// Linha de ferragem (valor digitado), perfil ou acessório (do catálogo) do
// modelo. Perfil e acessório usam fórmulas com as variáveis L (largura mm),
// H (altura mm), F (folhas), A (área m²) e P (perímetro m).
export interface GlassComponent {
  kind?: GlassComponentKind
  name: string
  mode?: 'fixed' | 'per_m2' | 'per_perimeter'
  quantity?: number
  unit_value?: number
  profile_id?: string | null
  accessory_id?: string | null
  length_formula?: string | null
  quantity_formula?: string | null
  // Perfil/acessório escolhido por uma variável do modelo; condição = fórmula (zero = a linha não entra)
  profile_variable?: string | null
  accessory_variable?: string | null
  condition?: string | null
}

export interface GlassVariableOption {
  id: string
  label: string
  // número usado nas fórmulas quando a opção é escolhida (ex.: 1 = sim, 0 = não)
  value: number
  profile_id?: string | null
  accessory_id?: string | null
}

// Pergunta feita em cada item do modelo: lista de opções ou número digitado.
// A chave (ex.: T, FOLGA_L) vira variável nas fórmulas.
export interface GlassVariable {
  key: string
  label: string
  type: 'select' | 'number'
  unit?: string | null
  help?: string | null
  options?: GlassVariableOption[]
  // lista: id da opção; número: o valor
  default?: string | number | null
}

export type GlassVariableValues = Record<string, string | number>

export interface GlassProfileRecord {
  id: string
  code?: number
  name: string
  reference?: string | null
  line?: string | null
  color?: string | null
  bar_length_mm: number
  price_per_m: number
  cost_per_m: number
  active: boolean
}

export type GlassProfilePayload = Omit<GlassProfileRecord, 'id' | 'code'> & { company_id: string }

export interface GlassAccessoryRecord {
  id: string
  code?: number
  name: string
  reference?: string | null
  unit: string
  price: number
  cost: number
  active: boolean
}

export type GlassAccessoryPayload = Omit<GlassAccessoryRecord, 'id' | 'code'> & { company_id: string }

export interface GlassSimulationRow {
  name: string
  value: number
  error: string | null
}

export interface GlassTypeRecord {
  id: string
  code?: number
  name: string
  kind: string
  thickness_mm?: number | null
  color?: string | null
  price_per_m2: number
  cost_per_m2: number
  min_area_m2: number
  sheet_width_mm?: number | null
  sheet_height_mm?: number | null
  // Vidro grande: acima da área ou do lado mínimo, acréscimo (%) no preço e no custo do vidro
  jumbo_min_area_m2?: number | null
  jumbo_min_side_mm?: number | null
  jumbo_surcharge_percent?: number
  product_id?: string | null
  product?: { id: string; name: string } | null
  active: boolean
}

export interface GlassTypePayload {
  company_id: string
  name: string
  kind: string
  thickness_mm?: number
  color?: string | null
  price_per_m2: number
  cost_per_m2: number
  min_area_m2: number
  sheet_width_mm?: number | null
  sheet_height_mm?: number | null
  jumbo_min_area_m2?: number | null
  jumbo_min_side_mm?: number | null
  jumbo_surcharge_percent?: number
  product_id?: string | null
  active: boolean
}

export interface GlassModelRecord {
  id: string
  code?: number
  name: string
  category: string
  folhas: number
  line?: string | null
  supplier?: string | null
  gauge_mm?: number | null
  default_aluminum_color?: string | null
  default_accessory_color?: string | null
  default_glass_type_id?: string | null
  defaultGlassType?: GlassTypeRecord | null
  labor_per_m2: number
  labor_fixed: number
  cut_width_discount_mm?: number
  cut_height_discount_mm?: number
  product_id?: string | null
  product?: { id: string; name: string } | null
  image_url?: string | null
  components: GlassComponent[]
  variables?: GlassVariable[]
  active: boolean
}

export interface GlassModelPayload {
  company_id: string
  name: string
  category: string
  folhas: number
  line?: string | null
  supplier?: string | null
  gauge_mm?: number | null
  default_aluminum_color?: string | null
  default_accessory_color?: string | null
  default_glass_type_id?: string | null
  labor_per_m2: number
  labor_fixed: number
  cut_width_discount_mm: number
  cut_height_discount_mm: number
  product_id?: string | null
  components: GlassComponent[]
  variables: GlassVariable[]
  active: boolean
}

export interface GlassPriceBreakdown {
  glass: number
  components: { name: string; value: number }[]
  labor: number
}

export interface GlassPricePreview {
  area_m2: number
  billed_area_m2: number
  unit_price: number
  total: number
  breakdown: GlassPriceBreakdown
}

export interface GlassOrderItemRecord {
  id?: string
  glass_model_id?: string | null
  glass_type_id?: string | null
  location?: string | null
  description: string
  width_mm: number
  height_mm: number
  quantity: number
  area_m2?: number
  unit_price: number
  total: number
  price_overridden: boolean
  price_breakdown?: GlassPriceBreakdown | null
  notes?: string | null
  aluminum_color?: string | null
  accessory_color?: string | null
  delivery_date?: string | null
  item_type?: string | null
  variable_values?: GlassVariableValues | null
  production_stage?: number
}

export interface GlassOrderRecord {
  id: string
  code?: number
  people_id?: string | null
  people?: { id: string; name: string; document?: string | null } | null
  reference?: string | null
  status: number
  work_address?: string | null
  valid_until?: string | null
  expected_delivery?: string | null
  markup_percent: number
  discount_value: number
  items_total: number
  total: number
  notes?: string | null
  internal_notes?: string | null
  cancel_reason?: string | null
  approved_at?: string | null
  created_at?: string
  items?: GlassOrderItemRecord[]
  form_payment?: number
  installments?: number
  first_due_date?: string | null
  down_payment?: number
  category_id?: string | null
  bank_account_id?: string | null
  bills_generated_at?: string | null
  bills?: GlassOrderBill[]
  meta?: {
    contract?: { status: number; provider: string } | null
    nfe?: { id: string; status: number; numero: number | null } | null
  }
}

export interface GlassOrderBill {
  id: string
  name: string
  amount: number
  date_due: string
  status: number
  installment_number: number
}

export interface GlassOrderPayload {
  company_id: string
  people_id?: string | null
  reference?: string | null
  work_address?: string | null
  valid_until?: string | null
  expected_delivery?: string | null
  markup_percent: number
  discount_value: number
  notes?: string | null
  internal_notes?: string | null
  form_payment: number
  installments: number
  first_due_date?: string | null
  down_payment: number
  category_id?: string | null
  bank_account_id?: string | null
  items: GlassOrderItemRecord[]
}

export const GLASS_ORDER_STATUS = {
  QUOTE: 0,
  SALE: 1,
  PRODUCTION: 2,
  READY: 3,
  INSTALLED: 4,
  INVOICED: 5,
  CANCELED: 8,
} as const

export const GLASS_ORDER_STATUS_LABELS: Record<number, string> = {
  0: 'Orçamento',
  1: 'Venda',
  2: 'Em produção',
  3: 'Pronto',
  4: 'Instalado',
  5: 'Faturado',
  8: 'Cancelado',
}

function listParams(companyId: string, options: { search?: string; page?: number; limit?: number; active?: boolean }) {
  return {
    companyId,
    search: options.search,
    active: options.active ? 'true' : undefined,
    page: options.page ? String(options.page) : '1',
    limit: options.limit ? String(options.limit) : '10',
  }
}

export const fetchGlassTypes = (token: string, companyId: string, options: { search?: string; page?: number; limit?: number; active?: boolean } = {}) =>
  apiGet<Paginated<GlassTypeRecord>>('/glass-type', listParams(companyId, options), token)
export const fetchGlassType = (token: string, id: string) => apiGet<GlassTypeRecord>(`/glass-type/${id}`, {}, token)
export const createGlassType = (token: string, payload: GlassTypePayload) => apiPost<GlassTypeRecord>('/glass-type', payload, token)
export const updateGlassType = (token: string, id: string, payload: GlassTypePayload) => apiPut<GlassTypeRecord>(`/glass-type/${id}`, payload, token)
export const deleteGlassType = (token: string, id: string) => apiDelete<void>(`/glass-type/${id}`, token)

export const fetchGlassModels = (
  token: string,
  companyId: string,
  options: { search?: string; page?: number; limit?: number; active?: boolean; line?: string; supplier?: string; gauge?: string } = {}
) =>
  apiGet<Paginated<GlassModelRecord>>(
    '/glass-model',
    { ...listParams(companyId, options), line: options.line || undefined, supplier: options.supplier || undefined, gauge: options.gauge || undefined },
    token
  )

export interface GlassModelFilters {
  suppliers: string[]
  lines: string[]
  gauges: number[]
}
export const fetchGlassModelFilters = (token: string, companyId: string) =>
  apiGet<GlassModelFilters>('/glass-model/filters', { companyId }, token)

// Cores de perfil/alumínio e de acessório, com o acréscimo de preço que trazem.
export type GlassColorKind = 'profile' | 'accessory'
export const GLASS_COLOR_KIND_LABELS: Record<GlassColorKind, string> = {
  profile: 'Perfil / alumínio',
  accessory: 'Acessório',
}
export interface GlassColorRecord {
  id: string
  code?: number
  name: string
  kind: GlassColorKind
  price_adjust_percent: number
  active: boolean
}
export type GlassColorPayload = Omit<GlassColorRecord, 'id' | 'code'> & { company_id: string }

export const fetchGlassColors = (
  token: string,
  companyId: string,
  options: { search?: string; page?: number; limit?: number; active?: boolean; kind?: GlassColorKind } = {}
) =>
  apiGet<Paginated<GlassColorRecord>>('/glass-color', { ...listParams(companyId, options), kind: options.kind }, token)
export const fetchGlassColor = (token: string, id: string) => apiGet<GlassColorRecord>(`/glass-color/${id}`, {}, token)
export const createGlassColor = (token: string, payload: GlassColorPayload) => apiPost<GlassColorRecord>('/glass-color', payload, token)
export const updateGlassColor = (token: string, id: string, payload: GlassColorPayload) => apiPut<GlassColorRecord>(`/glass-color/${id}`, payload, token)
export const deleteGlassColor = (token: string, id: string) => apiDelete<void>(`/glass-color/${id}`, token)
export const fetchGlassModel = (token: string, id: string) => apiGet<GlassModelRecord>(`/glass-model/${id}`, {}, token)
export const createGlassModel = (token: string, payload: GlassModelPayload) => apiPost<GlassModelRecord>('/glass-model', payload, token)
export const updateGlassModel = (token: string, id: string, payload: GlassModelPayload) => apiPut<GlassModelRecord>(`/glass-model/${id}`, payload, token)
export const deleteGlassModel = (token: string, id: string) => apiDelete<void>(`/glass-model/${id}`, token)

export function fetchGlassOrders(
  token: string,
  companyId: string,
  options: { search?: string; page?: number; limit?: number; status?: string } = {}
) {
  return apiGet<Paginated<GlassOrderRecord>>(
    '/glass-order',
    { ...listParams(companyId, options), status: options.status || undefined },
    token
  )
}
export const fetchGlassOrder = (token: string, id: string) => apiGet<GlassOrderRecord>(`/glass-order/${id}`, {}, token)
export const createGlassOrder = (token: string, payload: GlassOrderPayload) => apiPost<GlassOrderRecord>('/glass-order', payload, token)
export const updateGlassOrder = (token: string, id: string, payload: GlassOrderPayload) => apiPut<GlassOrderRecord>(`/glass-order/${id}`, payload, token)
export const deleteGlassOrder = (token: string, id: string) => apiDelete<void>(`/glass-order/${id}`, token)
export const duplicateGlassOrder = (token: string, id: string) => apiPost<GlassOrderRecord>(`/glass-order/${id}/duplicate`, {}, token)
export const changeGlassOrderStatus = (token: string, id: string, status: number, cancelReason?: string) =>
  apiPut<GlassOrderRecord>(`/glass-order/${id}/status`, { status, cancel_reason: cancelReason }, token)
export const previewGlassPrice = (
  token: string,
  payload: {
    company_id: string
    glass_model_id?: string | null
    glass_type_id?: string | null
    width_mm: number
    height_mm: number
    quantity: number
    variable_values?: GlassVariableValues | null
    aluminum_color?: string | null
    accessory_color?: string | null
  }
) => apiPost<GlassPricePreview>('/glass-order/price-preview', payload, token)

export const generateGlassOrderBills = (token: string, id: string) =>
  apiPost<GlassOrderRecord>(`/glass-order/${id}/generate-bills`, {}, token)

export const printGlassContract = (token: string, id: string, contractTemplateId?: string) =>
  apiPost<{ url: string; html: string | null; signed?: boolean }>(`/glass-contract/print/${id}`, { contractTemplateId }, token)

export const sendGlassContract = (token: string, id: string, payload: { contractTemplateId?: string; whatsappId?: string }) =>
  apiPost<{ fileUrl: string; contractLink: string; whatsappQueued: boolean; whatsappError: string | null }>(
    `/glass-contract/send/${id}`,
    payload,
    token
  )

export const sendGlassContractLink = (token: string, id: string, whatsappId: string) =>
  apiPost<{ message: string; whatsappQueued: boolean }>(`/glass-contract/send-link/${id}`, { whatsappId }, token)

export const fetchGlassSendTimeline = (token: string, id: string) =>
  apiGet<SendTimeline>(`/glass-contract/${id}/send-timeline`, {}, token)

export const fetchGlassSignatureEvidence = (token: string, id: string) =>
  apiGet<{ signature: SignatureEvidence | null }>(`/glass-contract/${id}/signature-evidence`, {}, token)

// Orçamento impresso: opções (sim/não), mensagem do WhatsApp e observações padrão.
export interface GlassQuoteOptions {
  show_cover: boolean
  show_drawing: boolean
  show_measures: boolean
  show_colors: boolean
  show_delivery: boolean
  show_variables: boolean
  show_item_values: boolean
  show_total: boolean
  show_discount: boolean
  show_installments: boolean
  show_area: boolean
  show_avg_price_m2: boolean
  show_total_quantity: boolean
  show_validity: boolean
  show_notes: boolean
  show_acceptance: boolean
}

export interface GlassQuoteSettings {
  options: GlassQuoteOptions
  whatsapp_message: string
  observations: string
}

export const GLASS_QUOTE_OPTION_LABELS: { key: keyof GlassQuoteOptions; label: string }[] = [
  { key: 'show_cover', label: 'Imprimir capa' },
  { key: 'show_drawing', label: 'Desenho dos itens' },
  { key: 'show_measures', label: 'Medidas' },
  { key: 'show_colors', label: 'Cores (perfil e acessório)' },
  { key: 'show_delivery', label: 'Data de entrega' },
  { key: 'show_variables', label: 'Variáveis do modelo (opções escolhidas)' },
  { key: 'show_item_values', label: 'Valor de cada item' },
  { key: 'show_total', label: 'Valor total' },
  { key: 'show_discount', label: 'Desconto' },
  { key: 'show_installments', label: 'Parcelas de pagamento' },
  { key: 'show_area', label: 'Área em m²' },
  { key: 'show_avg_price_m2', label: 'Valor médio por m²' },
  { key: 'show_total_quantity', label: 'Quantidade total de peças' },
  { key: 'show_validity', label: 'Validade do orçamento' },
  { key: 'show_notes', label: 'Observações do pedido' },
  { key: 'show_acceptance', label: 'Campo "Aceite do cliente"' },
]

export const fetchGlassQuoteSettings = (token: string, companyId: string) =>
  apiGet<GlassQuoteSettings>('/glass-quote/settings', { companyId }, token)

export const saveGlassQuoteSettings = (token: string, companyId: string, settings: GlassQuoteSettings) =>
  apiPut<GlassQuoteSettings>('/glass-quote/settings', { company_id: companyId, ...settings }, token)

export const printGlassQuote = (token: string, id: string, settings: GlassQuoteSettings) =>
  apiPost<{ url: string }>(`/glass-order/${id}/quote/print`, settings, token)

export const sendGlassQuote = (token: string, id: string, whatsappId: string, settings: GlassQuoteSettings) =>
  apiPost<{ fileUrl: string; whatsappQueued: boolean }>(`/glass-order/${id}/quote/send`, { whatsappId, ...settings }, token)

export const uploadGlassModelImage = (token: string, id: string, file: File) => {
  const form = new FormData()
  form.append('image', file)
  return apiPostForm<GlassModelRecord>(`/glass-model/${id}/image`, form, token)
}
export const saveGlassVariableDefaults = (token: string, id: string, values: GlassVariableValues) =>
  apiPut<GlassModelRecord>(`/glass-model/${id}/variable-defaults`, { values }, token)
export const removeGlassModelImage = (token: string, id: string) => apiDelete<GlassModelRecord>(`/glass-model/${id}/image`, token)

export const GLASS_STAGE_LABELS: Record<number, string> = {
  0: 'Aguardando',
  1: 'Em corte',
  2: 'Têmpera / fornecedor',
  3: 'Pronto',
  4: 'Instalado',
}

export interface GlassProductionItem extends GlassOrderItemRecord {
  id: string
  glass_order_id: string
  production_stage: number
  order: {
    id: string
    code: number
    status: number
    reference?: string | null
    expected_delivery?: string | null
    people?: { name: string } | null
  }
  glassType?: { name: string } | null
  piece: { width_mm: number; height_mm: number; quantity: number }
}

export interface GlassCutPiece {
  order_id: string
  order_code: number
  client: string
  item_id: string
  description: string
  location: string
  width_mm: number
  height_mm: number
  quantity: number
}

export interface GlassCutGroup {
  glass_type_id: string | null
  glass_type: string
  pieces: GlassCutPiece[]
  total_pieces: number
  total_area_m2: number
}

export const fetchGlassProduction = (
  token: string,
  companyId: string,
  options: { stage?: string; search?: string; orderStatus?: string } = {}
) =>
  apiGet<GlassProductionItem[]>(
    '/glass-production',
    { companyId, stage: options.stage || undefined, search: options.search || undefined, orderStatus: options.orderStatus || undefined },
    token
  )

export const changeGlassItemStage = (token: string, ids: string[], stage: number) =>
  apiPut<{ updated: number }>('/glass-production/stage', { ids, stage }, token)

export const fetchGlassCutList = (token: string, companyId: string, orderIds?: string[]) =>
  apiGet<GlassCutGroup[]>(
    '/glass-production/cut-list',
    { companyId, orderIds: orderIds?.length ? orderIds.join(',') : undefined },
    token
  )

export type GlassAppointmentType = 'medicao' | 'instalacao' | 'entrega' | 'assistencia'

export const GLASS_APPOINTMENT_TYPES: { value: GlassAppointmentType; label: string }[] = [
  { value: 'medicao', label: 'Medição' },
  { value: 'instalacao', label: 'Instalação' },
  { value: 'entrega', label: 'Entrega' },
  { value: 'assistencia', label: 'Assistência' },
]

export const GLASS_APPOINTMENT_STATUS_LABELS: Record<number, string> = {
  0: 'Agendado',
  1: 'Concluído',
  2: 'Cancelado',
}

export interface GlassAppointmentRecord {
  id: string
  code?: number
  glass_order_id?: string | null
  people_id?: string | null
  type: GlassAppointmentType
  scheduled_at: string
  duration_minutes: number
  team?: string | null
  address?: string | null
  notes?: string | null
  status: number
  people?: { id: string; name: string; phone?: string | null } | null
  order?: { id: string; code: number; reference?: string | null; people?: { name: string } | null } | null
}

export interface GlassAppointmentPayload {
  company_id: string
  glass_order_id?: string | null
  people_id?: string | null
  type: GlassAppointmentType
  // Data e hora locais da empresa (AAAA-MM-DDTHH:mm)
  scheduled_at: string
  duration_minutes: number
  team?: string | null
  address?: string | null
  notes?: string | null
}

export const fetchGlassAppointments = (
  token: string,
  companyId: string,
  options: { from?: string; to?: string; type?: string } = {}
) =>
  apiGet<GlassAppointmentRecord[]>(
    '/glass-appointment',
    { companyId, from: options.from, to: options.to, type: options.type || undefined },
    token
  )
export const createGlassAppointment = (token: string, payload: GlassAppointmentPayload) =>
  apiPost<GlassAppointmentRecord>('/glass-appointment', payload, token)
export const updateGlassAppointment = (token: string, id: string, payload: GlassAppointmentPayload) =>
  apiPut<GlassAppointmentRecord>(`/glass-appointment/${id}`, payload, token)
export const changeGlassAppointmentStatus = (token: string, id: string, status: number) =>
  apiPut<GlassAppointmentRecord>(`/glass-appointment/${id}/status`, { status }, token)
export const deleteGlassAppointment = (token: string, id: string) => apiDelete<void>(`/glass-appointment/${id}`, token)

const AGENDA_ZONE = 'America/Cuiaba'

// Dia (AAAA-MM-DD) e hora (HH:mm) de um instante no fuso da empresa.
export function agendaDateKey(iso: string): string {
  return new Date(iso).toLocaleDateString('sv-SE', { timeZone: AGENDA_ZONE })
}

export function agendaTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { timeZone: AGENDA_ZONE, hour: '2-digit', minute: '2-digit' })
}

export function agendaToday(): string {
  return agendaDateKey(new Date().toISOString())
}

export function addDaysToKey(key: string, days: number): string {
  const date = new Date(`${key}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

// Segunda-feira da semana que contém o dia informado.
export function weekStartKey(key: string): string {
  const weekday = new Date(`${key}T12:00:00Z`).getUTCDay()
  return addDaysToKey(key, -((weekday + 6) % 7))
}

export const generateGlassOrderNfe = (token: string, orderId: string, payload: { product_id?: string | null; send?: boolean }) =>
  apiPost<{ nfe: { id: string; numero?: number | null; status: number }; mensagem: string }>(
    `/nfe/generate-from-glass-order/${orderId}`,
    payload,
    token
  )

type ListOptions = { search?: string; page?: number; limit?: number; active?: boolean }

export const fetchGlassProfiles = (token: string, companyId: string, options: ListOptions = {}) =>
  apiGet<Paginated<GlassProfileRecord>>('/glass-profile', listParams(companyId, options), token)
export const fetchGlassProfile = (token: string, id: string) => apiGet<GlassProfileRecord>(`/glass-profile/${id}`, {}, token)
export const createGlassProfile = (token: string, payload: GlassProfilePayload) => apiPost<GlassProfileRecord>('/glass-profile', payload, token)
export const updateGlassProfile = (token: string, id: string, payload: GlassProfilePayload) => apiPut<GlassProfileRecord>(`/glass-profile/${id}`, payload, token)
export const deleteGlassProfile = (token: string, id: string) => apiDelete<void>(`/glass-profile/${id}`, token)

export const fetchGlassAccessories = (token: string, companyId: string, options: ListOptions = {}) =>
  apiGet<Paginated<GlassAccessoryRecord>>('/glass-accessory', listParams(companyId, options), token)
export const fetchGlassAccessory = (token: string, id: string) => apiGet<GlassAccessoryRecord>(`/glass-accessory/${id}`, {}, token)
export const createGlassAccessory = (token: string, payload: GlassAccessoryPayload) => apiPost<GlassAccessoryRecord>('/glass-accessory', payload, token)
export const updateGlassAccessory = (token: string, id: string, payload: GlassAccessoryPayload) => apiPut<GlassAccessoryRecord>(`/glass-accessory/${id}`, payload, token)
export const deleteGlassAccessory = (token: string, id: string) => apiDelete<void>(`/glass-accessory/${id}`, token)

export const simulateGlassModel = (
  token: string,
  payload: {
    company_id: string
    width_mm: number
    height_mm: number
    folhas: number
    components: GlassComponent[]
    variables: GlassVariable[]
  }
) => apiPost<{ rows: GlassSimulationRow[]; total: number }>('/glass-model/simulate', payload, token)

export interface GlassProfilePieceGroup {
  profile_id: string
  profile: string
  line: string
  color: string
  bar_length_mm: number
  pieces: { order_code: number; client: string; item_id: string; description: string; length_mm: number; quantity: number }[]
  total_pieces: number
  total_length_m: number
}

export const fetchGlassProfileList = (token: string, companyId: string, orderIds?: string[]) =>
  apiGet<GlassProfilePieceGroup[]>(
    '/glass-production/profile-list',
    { companyId, orderIds: orderIds?.length ? orderIds.join(',') : undefined },
    token
  )

export interface GlassBarPlan {
  profile_id: string
  profile: string
  color: string
  bar_length_mm: number
  kerf_mm: number
  bars: { pieces: { length_mm: number; label: string }[]; used_mm: number; leftover_mm: number }[]
  too_long: { length_mm: number; label: string }[]
  total_bars: number
  total_leftover_mm: number
  utilization: number
  estimated_cost: number
}

export interface GlassSheetPlan {
  glass_type_id: string | null
  glass_type: string
  sheet_width_mm: number
  sheet_height_mm: number
  sheet_assumed: boolean
  kerf_mm: number
  sheets: {
    placements: { x: number; y: number; width_mm: number; height_mm: number; rotated: boolean; label: string }[]
    used_area_m2: number
    utilization: number
  }[]
  too_big: { width_mm: number; height_mm: number; label: string }[]
  total_sheets: number
  utilization: number
  estimated_cost: number
}

export const fetchGlassBarPlan = (token: string, companyId: string, options: { orderIds?: string[]; kerf: number }) =>
  apiGet<GlassBarPlan[]>(
    '/glass-production/bar-plan',
    { companyId, orderIds: options.orderIds?.length ? options.orderIds.join(',') : undefined, kerf: String(options.kerf) },
    token
  )

export const fetchGlassSheetPlan = (
  token: string,
  companyId: string,
  options: { orderIds?: string[]; kerf: number; rotate: boolean }
) =>
  apiGet<GlassSheetPlan[]>(
    '/glass-production/sheet-plan',
    {
      companyId,
      orderIds: options.orderIds?.length ? options.orderIds.join(',') : undefined,
      kerf: String(options.kerf),
      rotate: options.rotate ? 'true' : 'false',
    },
    token
  )

export interface GlassMemoryLine {
  kind: 'glass' | 'profile' | 'accessory' | 'free' | 'labor'
  name: string
  detail: string
  value: number
  cost: number
}

export interface GlassMemoryItem {
  id: string
  description: string
  location?: string | null
  model?: string | null
  glass_type?: string | null
  width_mm: number
  height_mm: number
  quantity: number
  area_m2: number
  billed_area_m2: number
  price_overridden: boolean
  saved_unit_price: number
  calculated_unit_price: number
  differs: boolean
  lines: GlassMemoryLine[]
  unit_cost: number
  unit_price: number
  total_cost: number
  total_price: number
  margin_value: number
  margin_percent: number
}

export interface GlassCalculationMemory {
  order: {
    id: string
    code: number
    status: number
    reference?: string | null
    client?: string | null
    markup_percent: number
    discount_value: number
  }
  items: GlassMemoryItem[]
  materials: {
    glass: { name: string; area_m2: number; pieces: number }[]
    profiles: { name: string; meters: number; pieces: number }[]
    accessories: { name: string; unit: string; quantity: number }[]
  }
  totals: { items_price: number; items_cost: number; final_total: number; margin_value: number; margin_percent: number }
}

export const fetchGlassCalculationMemory = (token: string, orderId: string) =>
  apiGet<GlassCalculationMemory>(`/glass-order/${orderId}/calculation-memory`, {}, token)

export interface GlassDashboardMonth {
  label: string
  sales: { count: number; total: number; prev_count: number; prev_total: number }
  quotes: { count: number; prev: number }
  new_clients: { count: number; prev: number }
  canceled: { count: number; prev: number }
  daily_sales: { date: string; total: number; count: number }[]
}

export interface GlassDashboard {
  period: string
  month: GlassDashboardMonth
  kpis: {
    open_quotes_count: number
    open_quotes_total: number
    sales_count: number
    sales_total: number
    average_ticket: number
    conversion_percent: number
    receivable: number
    overdue: number
  }
  by_status: Record<string, { count: number; total: number }>
  stages: Record<string, number>
  upcoming: GlassAppointmentRecord[]
  recent: GlassOrderRecord[]
}

export const fetchGlassDashboard = (token: string, companyId: string, period: string) =>
  apiGet<GlassDashboard>('/glass-dashboard', { companyId, period }, token)

// Compras: perfis (barras) e acessórios a comprar e pedido de têmpera ao fornecedor.
export interface GlassPurchaseBar {
  profile_id: string
  profile: string
  color: string
  bar_length_mm: number
  total_bars: number
  too_long: number
  estimated_cost: number
}

export interface GlassPurchaseAccessory {
  accessory_id: string
  name: string
  reference: string
  unit: string
  quantity: number
  estimated_cost: number
}

export const fetchGlassMaterials = (token: string, companyId: string, options: { orderIds?: string[]; kerf: number }) =>
  apiGet<{ bars: GlassPurchaseBar[]; accessories: GlassPurchaseAccessory[]; order_codes: number[] }>(
    '/glass-purchase/materials',
    { companyId, orderIds: options.orderIds?.join(','), kerf: String(options.kerf) },
    token
  )

export const fetchGlassTempering = (token: string, companyId: string, options: { orderIds?: string[]; allGlass: boolean }) =>
  apiGet<{ groups: GlassCutGroup[]; order_codes: number[] }>(
    '/glass-purchase/tempering',
    { companyId, orderIds: options.orderIds?.join(','), allGlass: options.allGlass ? 'true' : 'false' },
    token
  )

export interface GlassPurchaseDocPayload {
  company_id: string
  type: 'materials' | 'tempering'
  order_ids?: string[]
  supplier_id?: string | null
  notes?: string
  kerf?: number
  all_glass?: boolean
}

export const printGlassPurchase = (token: string, payload: GlassPurchaseDocPayload) =>
  apiPost<{ url: string }>('/glass-purchase/document', payload, token)

export const sendGlassPurchase = (
  token: string,
  payload: GlassPurchaseDocPayload & { whatsappId: string; message?: string; mark_stage?: boolean }
) => apiPost<{ fileUrl: string; whatsappQueued: boolean; moved: number }>('/glass-purchase/send', payload, token)
