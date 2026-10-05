import { apiGet, apiPost } from './api'

export interface ShopCatalogSummary {
  total: number
  published: number
  with_price: number
  publishable: number
  publishable_with_image: number
  published_with_image: number
}

export function fetchShopCatalogSummary(token: string, companyId: string) {
  return apiGet<ShopCatalogSummary>('/shop-catalog/summary', { companyId }, token)
}

export function publishShopCatalog(token: string, companyId: string, onlyWithImage: boolean) {
  return apiPost<{ published: number }>('/shop-catalog/publish', { companyId, only_with_image: onlyWithImage }, token)
}

export function unpublishShopCatalog(token: string, companyId: string) {
  return apiPost<{ unpublished: number }>('/shop-catalog/unpublish', { companyId }, token)
}
