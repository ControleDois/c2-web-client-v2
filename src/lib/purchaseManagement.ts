import { apiGet, apiPost, apiPut, apiDelete } from './api'
import type { ProductRecord } from './products'

export interface PurchaseStockItemRecord {
  id: string
  code?: number
  product_id: string
  product?: ProductRecord
  avg_price: number
  current_stock: number
  min_stock: number | null
}

export interface PurchaseStockItemPayload {
  company_id: string
  product_id: string
  avg_price?: number
  current_stock?: number
  min_stock?: number | null
}

export interface PurchaseRequestItemRecord {
  id: string
  product_id: string
  product?: ProductRecord
  quantity: number
  unit_price: number
  subtotal: number
}

export interface PurchaseRequestRecord {
  id: string
  code?: number
  status: number
  notes?: string | null
  total_amount: number
  created_at?: string
  requested_by_user?: { id: string; email?: string; people?: { name?: string } | null } | null
  items?: PurchaseRequestItemRecord[]
}

export interface CreatePurchaseRequestPayload {
  company_id: string
  notes?: string
  items: { product_id: string; quantity: number; unit_price: number }[]
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

export const PURCHASE_REQUEST_STATUS_LABELS: Record<number, string> = {
  0: 'Pendente',
  1: 'Atendida',
}

export function fetchPurchaseStockItems(
  token: string,
  companyId: string,
  options: { search?: string; page?: number; limit?: number } = {}
) {
  return apiGet<Paginated<PurchaseStockItemRecord>>(
    '/purchase-stock-item',
    {
      companyId,
      search: options.search,
      page: options.page ? String(options.page) : '1',
      limit: options.limit ? String(options.limit) : '100',
    },
    token
  )
}

export function addPurchaseStockItem(token: string, payload: PurchaseStockItemPayload) {
  return apiPost<PurchaseStockItemRecord>('/purchase-stock-item', payload, token)
}

export function updatePurchaseStockItem(token: string, id: string, payload: Partial<PurchaseStockItemPayload>) {
  return apiPut<PurchaseStockItemRecord>(`/purchase-stock-item/${id}`, payload, token)
}

export function removePurchaseStockItem(token: string, id: string) {
  return apiDelete<void>(`/purchase-stock-item/${id}`, token)
}

export function fetchPurchaseRequests(
  token: string,
  companyId: string,
  options: { page?: number; limit?: number } = {}
) {
  return apiGet<Paginated<PurchaseRequestRecord>>(
    '/purchase-request',
    {
      companyId,
      page: options.page ? String(options.page) : '1',
      limit: options.limit ? String(options.limit) : '10',
    },
    token
  )
}

export function fetchPurchaseRequest(token: string, id: string) {
  return apiGet<PurchaseRequestRecord>(`/purchase-request/${id}`, {}, token)
}

export function createPurchaseRequest(token: string, payload: CreatePurchaseRequestPayload) {
  return apiPost<PurchaseRequestRecord>('/purchase-request', payload, token)
}
