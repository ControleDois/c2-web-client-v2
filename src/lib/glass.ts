import { apiGet, apiPost, apiPut, apiDelete } from './api'
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

export interface GlassComponent {
  name: string
  mode: 'fixed' | 'per_m2' | 'per_perimeter'
  quantity: number
  unit_value: number
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
  active: boolean
}

export interface GlassModelRecord {
  id: string
  code?: number
  name: string
  category: string
  folhas: number
  default_glass_type_id?: string | null
  defaultGlassType?: GlassTypeRecord | null
  labor_per_m2: number
  labor_fixed: number
  components: GlassComponent[]
  active: boolean
}

export interface GlassModelPayload {
  company_id: string
  name: string
  category: string
  folhas: number
  default_glass_type_id?: string | null
  labor_per_m2: number
  labor_fixed: number
  components: GlassComponent[]
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
  meta?: { contract?: { status: number; provider: string } | null }
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

export const fetchGlassModels = (token: string, companyId: string, options: { search?: string; page?: number; limit?: number; active?: boolean } = {}) =>
  apiGet<Paginated<GlassModelRecord>>('/glass-model', listParams(companyId, options), token)
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
  payload: { company_id: string; glass_model_id?: string | null; glass_type_id?: string | null; width_mm: number; height_mm: number; quantity: number }
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
