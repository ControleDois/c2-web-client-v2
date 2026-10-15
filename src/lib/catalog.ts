import { apiDelete, apiGet, apiPost, apiPostForm, apiPut } from './api'

export type PriceRounding = 'none' | 'ceil_90' | 'ceil_99' | 'ceil_int'

export interface CatalogChannel {
  id: string
  type: string
  name: string
  ifood_merchant_id: string | null
  price_percent: number
  price_rounding: PriceRounding
  active: boolean
}

export interface CatalogChannelsResponse {
  own: { products: number }
  channels: CatalogChannel[]
}

export interface CatalogImage {
  url: string
}

export interface CatalogChannelImage extends CatalogImage {
  id: string
  position: number
}

export interface CatalogItem {
  product_id: string
  code: number
  name: string
  stock: number
  own: {
    active: boolean
    name: string
    description: string
    price: number
    images: CatalogImage[]
  }
  override: {
    active: boolean | null
    name: string | null
    description: string | null
    price: number | null
  }
  images: CatalogChannelImage[]
  effective: {
    active: boolean
    name: string
    description: string
    price: number
    price_source: 'override' | 'rule' | 'same'
    image_source: 'channel' | 'own' | 'none'
    images: CatalogImage[]
  }
  external: { id: string; status: string; imported: boolean } | null
  sync: { status: 'ok' | 'error' | null; at: string | null; error: string | null; pending: boolean }
}

export interface CatalogSyncResult {
  total: number
  synced: number
  unchanged: number
  failed: { productId: string; name: string; error: string }[]
}

export const PRICE_ROUNDING_LABELS: Record<PriceRounding, string> = {
  none: 'Sem arredondar',
  ceil_90: 'Terminar em ,90',
  ceil_99: 'Terminar em ,99',
  ceil_int: 'Valor inteiro (para cima)',
}

export function fetchCatalogChannels(token: string, companyId: string) {
  return apiGet<CatalogChannelsResponse>('/catalog/channels', { companyId }, token)
}

export function saveCatalogChannel(
  token: string,
  channelId: string,
  data: { price_percent?: number; price_rounding?: PriceRounding; active?: boolean; name?: string }
) {
  return apiPut<CatalogChannel>(`/catalog/channels/${channelId}`, data, token)
}

export function fetchCatalogItems(token: string, channelId: string, search?: string) {
  return apiGet<CatalogItem[]>(`/catalog/channels/${channelId}/items`, { search: search || undefined }, token)
}

export function saveCatalogItem(
  token: string,
  channelId: string,
  productId: string,
  data: { active: boolean | null; name: string | null; description: string | null; price: number | null }
) {
  return apiPut<{ ok: true }>(`/catalog/channels/${channelId}/items/${productId}`, data, token)
}

export function uploadCatalogImage(token: string, channelId: string, productId: string, file: File) {
  const form = new FormData()
  form.append('file', file)
  return apiPostForm<CatalogChannelImage>(`/catalog/channels/${channelId}/items/${productId}/images`, form, token)
}

export function deleteCatalogImage(token: string, channelId: string, productId: string, imageId: string) {
  return apiDelete<{ ok: true }>(`/catalog/channels/${channelId}/items/${productId}/images/${imageId}`, token)
}

export function syncCatalogChannel(token: string, channelId: string, data: { product_id?: string; force?: boolean }) {
  return apiPost<CatalogSyncResult>(`/catalog/channels/${channelId}/sync`, data, token)
}

export interface OwnMenuItem {
  product_id: string
  code: number
  name: string
  product_price: number
  stock: number
  in_menu: boolean
  shop: {
    active: boolean
    name: string
    description: string
    price: number | null
    images: CatalogChannelImage[]
  }
}

export function fetchOwnMenuItems(token: string, companyId: string, search?: string) {
  return apiGet<OwnMenuItem[]>('/catalog/own/items', { companyId, search: search || undefined }, token)
}

export function saveOwnMenuItem(
  token: string,
  companyId: string,
  productId: string,
  data: { active: boolean; name: string; description: string; price: number | null }
) {
  return apiPut<{ ok: true }>(`/catalog/own/items/${productId}?companyId=${encodeURIComponent(companyId)}`, data, token)
}

export function uploadOwnMenuImage(token: string, companyId: string, productId: string, file: File) {
  const form = new FormData()
  form.append('file', file)
  return apiPostForm<CatalogChannelImage>(
    `/catalog/own/items/${productId}/images?companyId=${encodeURIComponent(companyId)}`,
    form,
    token
  )
}

export function deleteOwnMenuImage(token: string, companyId: string, productId: string, imageId: string) {
  return apiDelete<{ ok: true }>(
    `/catalog/own/items/${productId}/images/${imageId}?companyId=${encodeURIComponent(companyId)}`,
    token
  )
}
