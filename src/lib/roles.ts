import { apiGet, apiPost, apiPut, apiDelete } from './api'
import type { PermissionRecord } from './permissions'

export interface RoleRecord {
  id: string
  code?: number
  name: string
  description?: string | null
  system_type?: number
  permissions?: PermissionRecord[]
}

export interface RolePayload {
  name: string
  description: string
  system_type: number
  permissions: string[]
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

export function fetchRoles(
  token: string,
  companyId: string,
  options: { search?: string; page?: number; limit?: number } = {}
) {
  return apiGet<Paginated<RoleRecord>>(
    '/role',
    {
      companyId,
      search: options.search,
      page: options.page ? String(options.page) : '1',
      limit: options.limit ? String(options.limit) : '100',
    },
    token
  )
}

export function fetchRole(token: string, id: string) {
  return apiGet<RoleRecord>(`/role/${id}`, {}, token)
}

export function createRole(token: string, payload: RolePayload) {
  return apiPost<RoleRecord>('/role', payload, token)
}

export function updateRole(token: string, id: string, payload: RolePayload) {
  return apiPut<RoleRecord>(`/role/${id}`, payload, token)
}

export function deleteRole(token: string, id: string) {
  return apiDelete<void>(`/role/${id}`, token)
}
