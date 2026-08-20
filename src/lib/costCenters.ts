import { apiGet, apiPost, apiPut, apiDelete } from './api'

export interface CostCenterRecord {
  id: string
  code?: number
  name: string
}

export interface CostCenterPayload {
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

export function fetchCostCenters(
  token: string,
  companyId: string,
  options: { search?: string; page?: number; limit?: number } = {}
) {
  return apiGet<Paginated<CostCenterRecord>>(
    '/cost-center',
    {
      companyId,
      search: options.search,
      page: options.page ? String(options.page) : '1',
      limit: options.limit ? String(options.limit) : '10',
    },
    token
  )
}

export function fetchCostCenter(token: string, id: string) {
  return apiGet<CostCenterRecord>(`/cost-center/${id}`, {}, token)
}

export function createCostCenter(token: string, payload: CostCenterPayload) {
  return apiPost<CostCenterRecord>('/cost-center', payload, token)
}

export function updateCostCenter(token: string, id: string, payload: CostCenterPayload) {
  return apiPut<CostCenterRecord>(`/cost-center/${id}`, payload, token)
}

export function deleteCostCenter(token: string, id: string) {
  return apiDelete<void>(`/cost-center/${id}`, token)
}

// O backend não tem endpoint de exclusão em lote para centros de custo —
// removemos um por um para manter a mesma experiência das outras listagens.
export function deleteCostCentersSelected(token: string, ids: string[]) {
  return Promise.all(ids.map((id) => deleteCostCenter(token, id)))
}
