import { apiGet, apiPost, apiDelete } from './api'

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
