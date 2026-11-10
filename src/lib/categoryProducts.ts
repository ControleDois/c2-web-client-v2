import { apiGet, apiPost, apiPut, apiDelete } from './api'

export interface CategoryProductRecord {
  id: string
  code?: number
  name: string
  position?: number | null
}

export interface CategoryProductPayload {
  company_id: string
  name: string
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

export function fetchCategoryProducts(
  token: string,
  companyId: string,
  options: { search?: string; page?: number; limit?: number; sortedBy?: 'name' | 'position' } = {}
) {
  return apiGet<Paginated<CategoryProductRecord>>(
    '/category-product',
    {
      companyId,
      search: options.search,
      page: options.page ? String(options.page) : '1',
      limit: options.limit ? String(options.limit) : '100',
      sortedBy: options.sortedBy,
    },
    token
  )
}

export function createCategoryProduct(token: string, payload: CategoryProductPayload) {
  return apiPost<CategoryProductRecord>('/category-product', payload, token)
}

export function updateCategoryProduct(token: string, id: string, payload: CategoryProductPayload) {
  return apiPut<CategoryProductRecord>(`/category-product/${id}`, payload, token)
}

export function deleteCategoryProduct(token: string, id: string) {
  return apiDelete<void>(`/category-product/${id}`, token)
}

// Ordem das categorias no cardápio (totem e loja online): ids na ordem desejada.
export function reorderCategoryProducts(token: string, companyId: string, ids: string[]) {
  return apiPost<{ updated: number }>('/category-product/reorder', { company_id: companyId, ids }, token)
}
