import { apiGet, apiPostForm, apiPutForm } from './api'

export interface UserRecord {
  id: string
  code?: number
  internal_code?: number | null
  name: string
  file_url?: string | null
  user?: { id: string; email: string } | null
  role?: { id: string; name: string } | null
  createdAt?: string
  created_at?: string
}

export interface UserDetail {
  id: string
  email: string
  people?: {
    id: string
    name?: string
    internal_code?: number | null
    file_url?: string | null
    role?: { id: string; name: string } | null
  } | null
  companies?: {
    id: string
    people?: { name?: string; document?: string } | null
  }[]
}

export interface UserPayload {
  email: string
  password?: string
  roleId?: string
  internalCode?: number
  name?: string
  file?: File
  companies?: string[]
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

function buildUserFormData(payload: UserPayload): FormData {
  const form = new FormData()
  form.append('email', payload.email)
  if (payload.password) form.append('password', payload.password)
  if (payload.roleId) form.append('roleId', payload.roleId)
  if (payload.internalCode !== undefined) form.append('internalCode', String(payload.internalCode))
  if (payload.name) form.append('name', payload.name)
  if (payload.companies) form.append('companies', JSON.stringify(payload.companies))
  if (payload.file) form.append('file', payload.file)
  return form
}

export function fetchUsers(
  token: string,
  companyId: string,
  options: { search?: string; page?: number; limit?: number } = {}
) {
  return apiGet<Paginated<UserRecord>>(
    '/user',
    {
      companyId,
      search: options.search,
      page: options.page ? String(options.page) : '1',
      limit: options.limit ? String(options.limit) : '10',
    },
    token
  )
}

export function fetchUser(token: string, id: string, companyId: string) {
  return apiGet<UserDetail>(`/user/${id}`, { companyId }, token)
}

export function createUser(token: string, companyId: string, payload: UserPayload) {
  return apiPostForm<UserDetail>(`/user?companyId=${encodeURIComponent(companyId)}`, buildUserFormData(payload), token)
}

export function updateUser(token: string, id: string, companyId: string, payload: UserPayload) {
  return apiPutForm<UserDetail>(
    `/user/${id}?companyId=${encodeURIComponent(companyId)}`,
    buildUserFormData(payload),
    token
  )
}
