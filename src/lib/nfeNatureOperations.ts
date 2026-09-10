import { apiGet, apiPost, apiPut, apiDelete } from './api'

export interface NfeNatureOperationRecord {
  id: string
  code?: number
  description: string
  finality: number
  cfop_state: string
  cfop_interstate: string
}

export interface NfeNatureOperationPayload {
  company_id: string
  description: string
  finality: number
  cfop_state: string
  cfop_interstate: string
}

export const NFE_NATURE_OPERATION_FINALITY_LABELS: Record<number, string> = {
  1: 'Normal',
  2: 'Complementar',
  3: 'Ajuste',
  4: 'Devolução',
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

export function fetchNfeNatureOperations(
  token: string,
  companyId: string,
  options: { search?: string; page?: number; limit?: number } = {}
) {
  return apiGet<Paginated<NfeNatureOperationRecord>>(
    '/nfe-nature-operation',
    {
      companyId,
      search: options.search,
      page: options.page ? String(options.page) : '1',
      limit: options.limit ? String(options.limit) : '10',
    },
    token
  )
}

export function fetchNfeNatureOperation(token: string, id: string) {
  return apiGet<NfeNatureOperationRecord>(`/nfe-nature-operation/${id}`, {}, token)
}

export function createNfeNatureOperation(token: string, payload: NfeNatureOperationPayload) {
  return apiPost<NfeNatureOperationRecord>('/nfe-nature-operation', payload, token)
}

export function updateNfeNatureOperation(token: string, id: string, payload: NfeNatureOperationPayload) {
  return apiPut<NfeNatureOperationRecord>(`/nfe-nature-operation/${id}`, payload, token)
}

export function deleteNfeNatureOperation(token: string, id: string) {
  return apiDelete<void>(`/nfe-nature-operation/${id}`, token)
}
