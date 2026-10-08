import { apiGet, apiPost } from './api'

export interface Paginated<T> {
  data: T[]
  meta?: { total: number; per_page: number; current_page: number; last_page: number }
}

// 0 emitida (vale), 1 trocada (baixa feita), 2 cancelada
export const SALE_TOKEN_STATUS_LABELS: Record<number, string> = {
  0: 'Vale',
  1: 'Trocada',
  2: 'Cancelada',
}

export interface SaleTokenRecord {
  id: string
  code?: number
  sale_id: string
  product_name: string
  sale_code?: number | null
  token_code: string
  sequence: number
  total: number
  status: number
  redeemed_at?: string | null
  created_at?: string
}

export interface SaleTokenSummary {
  issued_today: number
  redeemed_today: number
  pending_total: number
  pending_by_product: { product_name: string; total: number }[]
}

export function fetchSaleTokens(
  token: string,
  companyId: string,
  options: { search?: string; status?: string; page?: number; limit?: number } = {}
) {
  return apiGet<Paginated<SaleTokenRecord>>(
    '/sale-token',
    {
      companyId,
      search: options.search,
      status: options.status || undefined,
      page: options.page ? String(options.page) : '1',
      limit: options.limit ? String(options.limit) : '20',
    },
    token
  )
}

export const fetchSaleTokenSummary = (token: string, companyId: string) =>
  apiGet<SaleTokenSummary>('/sale-token/summary', { companyId }, token)
export const cancelSaleToken = (token: string, id: string) => apiPost<SaleTokenRecord>(`/sale-token/${id}/cancel`, {}, token)
export const undoSaleTokenRedeem = (token: string, id: string) => apiPost<SaleTokenRecord>(`/sale-token/${id}/undo`, {}, token)
