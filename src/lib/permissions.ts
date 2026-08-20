import { apiGet, apiPost, apiPut, apiDelete } from './api'

export interface PermissionRecord {
  id: string
  code?: number
  module: string
  action: string
  slug: string
}

export interface PermissionPayload {
  module: string
  action: string
  slug: string
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

export function fetchPermissions(
  token: string,
  options: { search?: string; page?: number; limit?: number } = {}
) {
  return apiGet<Paginated<PermissionRecord>>(
    '/permission',
    {
      search: options.search,
      page: options.page ? String(options.page) : '1',
      limit: options.limit ? String(options.limit) : '20',
    },
    token
  )
}

export function fetchPermission(token: string, id: string) {
  return apiGet<PermissionRecord>(`/permission/${id}`, {}, token)
}

export function createPermission(token: string, payload: PermissionPayload) {
  return apiPost<PermissionRecord>('/permission', payload, token)
}

export function updatePermission(token: string, id: string, payload: PermissionPayload) {
  return apiPut<PermissionRecord>(`/permission/${id}`, payload, token)
}

export function deletePermission(token: string, id: string) {
  return apiDelete<void>(`/permission/${id}`, token)
}
