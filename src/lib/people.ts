import { apiGet, apiPostForm, apiPutForm, apiDelete, apiPost } from './api'

export interface PersonAddress {
  zip_code?: string
  address?: string
  number?: string
  state?: string
  city?: string
  district?: string
  complement?: string
  code_ibge?: string
}

export interface PersonDocument {
  id: string
  title: string
  description?: string | null
  file_url?: string | null
  file_name?: string | null
  file_size?: number | null
}

export interface PersonDocumentInput {
  id?: string
  title: string
  description?: string
  file?: File
}

export interface PersonRecord {
  id: string
  code?: number
  internal_code?: number | null
  name: string
  social_name?: string | null
  people_type?: number
  document: string
  roles?: number[]
  status?: number[]
  phone?: string | null
  email?: string | null
  birth?: string | null
  file_url?: string | null
  address?: PersonAddress | null
  documents?: PersonDocument[]
  createdAt?: string
  created_at?: string
}

export interface PersonPayload {
  company_id: string
  name: string
  document: string
  social_name?: string
  people_type?: number
  roles?: number[]
  status?: number[]
  phone?: string
  email?: string
  internal_code?: number
  birth?: string
  address?: PersonAddress
  documents?: PersonDocumentInput[]
  file?: File
}

interface Paginated<T> {
  data: T[]
  meta: {
    total: number
    per_page: number
    current_page: number
    last_page: number
  }
}

export const ROLE_LABELS: Record<number, string> = {
  0: 'Usuário',
  1: 'Empresa',
  2: 'Cliente',
  3: 'Fornecedor',
  4: 'Transportadora',
  5: 'Mecânico',
  6: 'Gerente',
  7: 'Operador',
  8: 'Motorista',
}

export const STATUS_LABELS: Record<number, string> = {
  0: 'Ativo',
  1: 'Inativo',
  2: 'Pendente',
  3: 'Inadimplente',
  4: 'Negado',
}

export function fetchPeople(
  token: string,
  companyId: string,
  options: { search?: string; page?: number; limit?: number; role?: number } = {}
) {
  return apiGet<Paginated<PersonRecord>>(
    '/people',
    {
      companyId,
      search: options.search,
      page: options.page ? String(options.page) : '1',
      limit: options.limit ? String(options.limit) : '10',
      roles: options.role !== undefined ? `{${options.role}}` : undefined,
      orderBy: 'name',
      sortedBy: 'asc',
    },
    token
  )
}

export function fetchPerson(token: string, id: string) {
  return apiGet<PersonRecord>(`/people/${id}`, {}, token)
}

export function fetchMyPerson(token: string, companyId: string) {
  return apiGet<PersonRecord>('/people/me', { companyId }, token)
}

function buildPersonForm(payload: PersonPayload): FormData {
  const form = new FormData()

  const plainFields: [string, string | number | undefined][] = [
    ['company_id', payload.company_id],
    ['name', payload.name],
    ['document', payload.document],
    ['social_name', payload.social_name],
    ['people_type', payload.people_type],
    ['phone', payload.phone],
    ['email', payload.email],
    ['internal_code', payload.internal_code],
    ['birth', payload.birth],
  ]
  for (const [key, value] of plainFields) {
    if (value !== undefined && value !== '') form.append(key, String(value))
  }

  for (const roleId of payload.roles ?? []) {
    form.append('roles[]', String(roleId))
  }
  for (const statusId of payload.status ?? []) {
    form.append('status[]', String(statusId))
  }

  if (payload.address) {
    for (const [key, value] of Object.entries(payload.address)) {
      if (value) form.append(`address[${key}]`, String(value))
    }
  }

  payload.documents?.forEach((doc, index) => {
    if (doc.id) form.append(`documents[${index}][id]`, doc.id)
    form.append(`documents[${index}][title]`, doc.title)
    form.append(`documents[${index}][description]`, doc.description ?? '')
    if (doc.file) form.append(`documents[${index}][file]`, doc.file)
  })

  if (payload.file) form.append('file', payload.file)

  return form
}

export function createPerson(token: string, payload: PersonPayload) {
  return apiPostForm<PersonRecord>('/people', buildPersonForm(payload), token)
}

export function updatePerson(token: string, id: string, payload: PersonPayload) {
  return apiPutForm<PersonRecord>(`/people/${id}`, buildPersonForm(payload), token)
}

export function deletePerson(token: string, id: string) {
  return apiDelete<void>(`/people/${id}`, token)
}

export function deletePeopleSelected(token: string, ids: string[]) {
  return apiPost<void>('/people/destroy-selected', { ids }, token)
}
