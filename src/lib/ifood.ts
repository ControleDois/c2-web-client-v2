import { apiGet, apiPost, apiDelete, apiPut } from './api'

export type IfoodMerchantStatus = 'pending' | 'authorized' | 'revoked'

export interface IfoodMerchantRecord {
  id: string
  merchant_id: string | null
  merchant_name: string | null
  status: IfoodMerchantStatus
  user_code: string | null
  authorized_at: string | null
}

export interface IfoodConnectResult {
  id: string
  user_code: string
  verification_url: string
  verification_url_complete: string
  expires_in: number
}

export interface IfoodCatalogSyncResult {
  total: number
  synced: number
  failed: { productId: string; name: string; error: string }[]
}

export function fetchIfoodMerchants(token: string, companyId: string) {
  return apiGet<IfoodMerchantRecord[]>('/ifood/merchants', { company_id: companyId }, token)
}

export function connectIfoodMerchant(token: string, companyId: string) {
  return apiPost<IfoodConnectResult>('/ifood/merchants/connect', { company_id: companyId }, token)
}

export function linkIfoodMerchant(token: string, companyId: string, merchantId: string) {
  return apiPost<{ id: string; status: IfoodMerchantStatus; merchant_name: string | null }>(
    '/ifood/merchants/link',
    { company_id: companyId, merchant_id: merchantId },
    token
  )
}

export function confirmIfoodMerchant(
  token: string,
  id: string,
  payload: { merchant_id: string; merchant_name?: string }
) {
  return apiPost<{ id: string; status: IfoodMerchantStatus }>(`/ifood/merchants/${id}/confirm`, payload, token)
}

export function syncIfoodCatalog(token: string, id: string) {
  return apiPost<IfoodCatalogSyncResult>(`/ifood/merchants/${id}/sync-catalog`, {}, token)
}

export function deleteIfoodMerchant(token: string, id: string) {
  return apiDelete<{ id: string; status: IfoodMerchantStatus }>(`/ifood/merchants/${id}`, token)
}

export interface IfoodImportPreview {
  totals: {
    items: number
    categories: number
    available: number
    noName: number
    noPrice: number
    already: number
    matched: number
    new: number
  }
  categories: { name: string; count: number }[]
  matched: {
    ifoodName: string | null
    ifoodPrice: number
    ourName: string
    ourPrice: number
    by: 'barcode' | 'name' | null
  }[]
  unmatched: { name: string | null; price: number; category: string }[]
  diagnostics: { categoryKeys: string[]; itemKeys: string[] }
}

export interface IfoodImportResult {
  linked: number
  created: number
  skipped: number
  errors: { name: string; error: string }[]
}

export function previewIfoodCatalogImport(token: string, id: string) {
  return apiPost<IfoodImportPreview>(`/ifood/merchants/${id}/import-catalog/preview`, {}, token)
}

export function importIfoodCatalog(token: string, id: string, createMissing: boolean) {
  return apiPost<IfoodImportResult>(`/ifood/merchants/${id}/import-catalog`, { createMissing }, token)
}

export interface IfoodCredentialsCheck {
  mode: 'production' | 'test'
  configured: boolean
  clientIdStart: string | null
  accepted: boolean
  merchants: { id: string; name: string }[]
  error: string | null
}

export function testIfoodCredentials(token: string, companyId: string) {
  return apiPost<IfoodCredentialsCheck>('/ifood/credentials/test', { company_id: companyId }, token)
}

// ---- Módulo Merchant: loja, disponibilidade, pausas e horário ----

export interface IfoodInterruption {
  id: string
  description?: string
  start: string
  end: string
}

export interface IfoodOpeningDay {
  day: string
  periods: { start: string; end: string }[]
}

export function fetchIfoodMerchantDetails(token: string, id: string) {
  return apiGet<Record<string, unknown>>(`/ifood/merchants/${id}/details`, undefined, token)
}

export function fetchIfoodMerchantAvailability(token: string, id: string) {
  return apiGet<unknown>(`/ifood/merchants/${id}/availability`, undefined, token)
}

export function fetchIfoodInterruptions(token: string, id: string) {
  return apiGet<IfoodInterruption[]>(`/ifood/merchants/${id}/interruptions`, undefined, token)
}

export function createIfoodInterruption(
  token: string,
  id: string,
  data: { description: string; start: string; end: string }
) {
  return apiPost<unknown>(`/ifood/merchants/${id}/interruptions`, data, token)
}

export function deleteIfoodInterruption(token: string, id: string, interruptionId: string) {
  return apiDelete<{ ok: true }>(`/ifood/merchants/${id}/interruptions/${interruptionId}`, token)
}

export function fetchIfoodOpeningHours(token: string, id: string) {
  return apiGet<{ days: IfoodOpeningDay[] }>(`/ifood/merchants/${id}/opening-hours`, undefined, token)
}

export function saveIfoodOpeningHours(token: string, id: string, days: IfoodOpeningDay[]) {
  return apiPut<{ ok: true; shifts: number }>(`/ifood/merchants/${id}/opening-hours`, { days }, token)
}
