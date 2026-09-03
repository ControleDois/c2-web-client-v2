import { apiGet, apiPost, apiPut, apiDelete } from './api'

export interface RentalTypeRecord {
  id: string
  code?: number
  name: string
  contract_template_id?: string | null
  contractTemplate?: { id: string; title: string } | null
}

export interface RentalTypePayload {
  company_id: string
  name: string
  contract_template_id?: string
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

export function fetchRentalTypes(
  token: string,
  companyId: string,
  options: { search?: string; page?: number; limit?: number } = {}
) {
  return apiGet<Paginated<RentalTypeRecord>>(
    '/rental-type',
    {
      companyId,
      search: options.search,
      page: options.page ? String(options.page) : '1',
      limit: options.limit ? String(options.limit) : '10',
    },
    token
  )
}

export function fetchRentalType(token: string, id: string) {
  return apiGet<RentalTypeRecord>(`/rental-type/${id}`, {}, token)
}

export function createRentalType(token: string, payload: RentalTypePayload) {
  return apiPost<RentalTypeRecord>('/rental-type', payload, token)
}

export function updateRentalType(token: string, id: string, payload: RentalTypePayload) {
  return apiPut<RentalTypeRecord>(`/rental-type/${id}`, payload, token)
}

export function deleteRentalType(token: string, id: string) {
  return apiDelete<void>(`/rental-type/${id}`, token)
}

// O backend não tem endpoint de exclusão em lote para tipos de aluguel —
// removemos um por um para manter a mesma experiência das outras listagens.
export function deleteRentalTypesSelected(token: string, ids: string[]) {
  return Promise.all(ids.map((id) => deleteRentalType(token, id)))
}
