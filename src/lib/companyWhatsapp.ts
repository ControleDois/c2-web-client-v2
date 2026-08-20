import { apiGet, apiPost, apiPut, apiDelete } from './api'

export interface CompanyWhatsappRecord {
  id: string
  code?: number
  companyId: string
  name: string
  phone: string
  status: number
  token?: string | null
  official_whatsapp: boolean
  send_bill_pix_button: boolean
  send_bill_boleto_document: boolean
  ai_agent_active: boolean
  general_ai_agent_active: boolean
}

export interface CompanyWhatsappPayload {
  company_id: string
  name: string
  phone: string
  official_whatsapp?: boolean
  token?: string
  send_bill_pix_button?: boolean
  send_bill_boleto_document?: boolean
  ai_agent_active?: boolean
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

export const WHATSAPP_STATUS_CONNECTED = 1

export function fetchCompanyWhatsapps(
  token: string,
  companyId: string,
  options: { search?: string; page?: number; limit?: number } = {}
) {
  return apiGet<Paginated<CompanyWhatsappRecord>>(
    '/whatsapp',
    {
      companyId,
      search: options.search,
      page: options.page ? String(options.page) : '1',
      limit: options.limit ? String(options.limit) : '50',
    },
    token
  )
}

export function createCompanyWhatsapp(token: string, payload: CompanyWhatsappPayload) {
  return apiPost<CompanyWhatsappRecord>('/whatsapp', payload, token)
}

export function updateCompanyWhatsapp(token: string, id: string, payload: CompanyWhatsappPayload) {
  return apiPut<CompanyWhatsappRecord>(`/whatsapp/${id}`, payload, token)
}

export function deleteCompanyWhatsapp(token: string, id: string) {
  return apiDelete<void>(`/whatsapp/${id}`, token)
}

export interface UazapiInstanceResult {
  id: string
  status: number
  state?: string
  connected?: boolean
  qrCode?: string
  message?: string
}

export function prepareWhatsappInstance(token: string, id: string, companyId: string) {
  return apiPost<UazapiInstanceResult>(`/uazapi/instances/${id}/prepare?companyId=${encodeURIComponent(companyId)}`, {}, token)
}

export function connectWhatsappInstance(token: string, id: string, companyId: string) {
  return apiPost<UazapiInstanceResult>(`/uazapi/instances/${id}/connect?companyId=${encodeURIComponent(companyId)}`, {}, token)
}

export function whatsappInstanceStatus(token: string, id: string, companyId: string) {
  return apiGet<UazapiInstanceResult>(`/uazapi/instances/${id}/status`, { companyId }, token)
}

export function disconnectWhatsappInstance(token: string, id: string, companyId: string) {
  return apiPost<{ id: string; status: number }>(
    `/uazapi/instances/${id}/disconnect?companyId=${encodeURIComponent(companyId)}`,
    {},
    token
  )
}
