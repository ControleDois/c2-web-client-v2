import { apiGet, apiPost } from './api'

export interface ShopCatalogSummary {
  total: number
  published: number
  with_price: number
  publishable: number
  published_with_image: number
}

export function fetchShopCatalogSummary(token: string, companyId: string) {
  return apiGet<ShopCatalogSummary>('/shop-catalog/summary', { companyId }, token)
}

export function publishShopCatalog(token: string, companyId: string) {
  return apiPost<{ published: number }>('/shop-catalog/publish', { companyId }, token)
}

export function unpublishShopCatalog(token: string, companyId: string) {
  return apiPost<{ unpublished: number }>('/shop-catalog/unpublish', { companyId }, token)
}
