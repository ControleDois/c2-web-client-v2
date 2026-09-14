import { apiGet, apiPatch, apiPost } from './api'

export type LicenseStatus = 'trial' | 'active' | 'blocked'

export interface LicenseRepresentative {
  id: string
  email: string
  people?: { id: string; name: string } | null
}

export function representativeName(representative: LicenseRepresentative | null | undefined): string {
  if (!representative) return ''
  return representative.people?.name || representative.email
}

export interface LicenseCompanyPeople {
  name: string
  document: string | null
}

export interface LicenseDelphiKey {
  key: string
  dueDate: string | null
}

export interface LicenseCompanyRecord {
  id: string
  license_status: LicenseStatus
  license_expires_at: string | null
  monthly_fee: number | null
  commission_percent: number | null
  representative_user_id: string | null
  representative: LicenseRepresentative | null
  people: LicenseCompanyPeople | null
  createdAt?: string
}

export interface LicenseCompanyDetail extends LicenseCompanyRecord {
  delphiKey: LicenseDelphiKey | null
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

export interface DuplicateCompanyGroup {
  document: string
  items: { id: string; name: string; document: string }[]
}

export interface RepresentativeOption {
  id: string
  userId: string
  name: string
}

export function fetchLicenseCompanies(
  token: string,
  options: { search?: string; page?: number; limit?: number } = {}
) {
  return apiGet<Paginated<LicenseCompanyRecord>>(
    '/license/companies',
    {
      search: options.search,
      page: options.page ? String(options.page) : '1',
      limit: options.limit ? String(options.limit) : '20',
    },
    token
  )
}

export function fetchLicenseCompany(token: string, id: string) {
  return apiGet<LicenseCompanyDetail>(`/license/companies/${id}`, {}, token)
}

export interface UpdateLicenseCompanyPayload {
  license_status?: LicenseStatus
  license_expires_at?: string | null
  delphi_key_due_date?: string
  monthly_fee?: number | null
  commission_percent?: number | null
  representative_user_id?: string | null
}

export function updateLicenseCompany(token: string, id: string, payload: UpdateLicenseCompanyPayload) {
  return apiPatch<LicenseCompanyDetail>(`/license/companies/${id}`, payload, token)
}

export function syncSaasClients(token: string) {
  return apiPost<unknown>('/license/sync-clients', {}, token)
}

export function fetchDuplicateCompanies(token: string) {
  return apiGet<DuplicateCompanyGroup[]>('/license/duplicate-companies', {}, token)
}

export function searchRepresentatives(token: string, search: string) {
  return apiGet<Paginated<{ id: string; userId: string; name: string }>>(
    '/license/representatives',
    { search, limit: '10' },
    token
  ).then((res) => res.data.map((item) => ({ id: item.id, userId: item.userId, name: item.name })))
}
