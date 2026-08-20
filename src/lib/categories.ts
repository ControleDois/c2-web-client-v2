import { apiGet, apiPost, apiPut, apiDelete } from './api'

export interface CategoryRecord {
  id: string
  code?: number
  name: string
  role?: number
  category_id?: string | null
  category?: { id: string; name: string } | null
}

export interface CategoryPayload {
  company_id: string
  name: string
  role?: number
  category_id?: string
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

export const CATEGORY_ROLE_LABELS: Record<number, string> = {
  0: 'Despesa',
  1: 'Receita',
}

export function fetchCategories(
  token: string,
  companyId: string,
  options: { search?: string; page?: number; limit?: number; role?: number } = {}
) {
  return apiGet<Paginated<CategoryRecord>>(
    '/category',
    {
      companyId,
      search: options.search,
      page: options.page ? String(options.page) : '1',
      limit: options.limit ? String(options.limit) : '10',
      role: options.role !== undefined ? String(options.role) : undefined,
    },
    token
  )
}

export function fetchCategory(token: string, id: string) {
  return apiGet<CategoryRecord>(`/category/${id}`, {}, token)
}

export function createCategory(token: string, payload: CategoryPayload) {
  return apiPost<CategoryRecord>('/category', payload, token)
}

export function updateCategory(token: string, id: string, payload: CategoryPayload) {
  return apiPut<CategoryRecord>(`/category/${id}`, payload, token)
}

export function deleteCategory(token: string, id: string) {
  return apiDelete<void>(`/category/${id}`, token)
}

export function deleteCategoriesSelected(token: string, ids: string[]) {
  return apiDelete<void>('/category/destroy-selected', token, { ids })
}
