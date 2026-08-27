import { apiGet, apiPostForm, apiPutForm } from './api'

export interface CompanyAddress {
  zip_code?: string
  address?: string
  number?: string
  state?: string
  city?: string
  district?: string
  complement?: string
  code_ibge?: string
}

export interface CompanyLicense {
  id: string
  active?: boolean
  system_type?: number
  license_status?: string
}

export interface CompanyRecord {
  id: string
  code?: number
  name: string
  social_name?: string | null
  people_type?: number
  document: string
  simple?: boolean
  phone?: string | null
  email?: string | null
  state_registration_indicator?: number
  state_registration?: string | null
  municipal_registration?: string | null
  inscription_suframa?: string | null
  general_record?: string | null
  crt?: number
  special_regime?: number
  certificate_path?: string | null
  certificate_password?: string | null
  file_url?: string | null
  address?: CompanyAddress | null
  company?: CompanyLicense | null
  createdAt?: string
  created_at?: string
}

export interface CompanyPayload {
  id?: string
  name: string
  document: string
  social_name?: string
  people_type?: number
  simple?: boolean
  state_registration_indicator?: number
  state_registration?: string
  municipal_registration?: string
  inscription_suframa?: string
  general_record?: string
  phone?: string
  email?: string
  crt?: number
  special_regime?: number
  active?: boolean
  system_type?: number
  address?: CompanyAddress
  certificate_file?: File
  certificate_password?: string
  logo_file?: File
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

export interface CertificateStatus {
  peopleId: string | null
  companyId: string | null
  document: string | null
  hasCertificate: boolean
  valid: boolean
  subject?: string
  validUntil?: string
  daysUntilExpiration?: number
  error?: string
}

export const STATE_REGISTRATION_INDICATOR_LABELS: Record<number, string> = {
  0: 'Não contribuinte',
  1: 'Contribuinte',
  2: 'Contribuinte isento',
}

export const CRT_LABELS: Record<number, string> = {
  1: 'Simples Nacional',
  2: 'Simples Nacional – excesso de sublimite',
  3: 'Regime Normal',
  4: 'Simples Nacional – MEI',
}

export const SPECIAL_REGIME_LABELS: Record<number, string> = {
  0: 'Sem regime especial',
  1: 'Microempresa Municipal',
  2: 'Estimativa',
  3: 'Sociedade de Profissionais',
  4: 'Cooperativa',
  5: 'Microempreendedor Individual (MEI)',
  6: 'Microempresa e Empresa de Pequeno Porte (ME/EPP)',
  7: 'Lucro Real',
}

export function fetchCompanies(
  token: string,
  options: { search?: string; page?: number; limit?: number; scope?: 'all'; companyId?: string } = {}
) {
  return apiGet<Paginated<CompanyRecord>>(
    '/company',
    {
      search: options.search,
      page: options.page ? String(options.page) : '1',
      limit: options.limit ? String(options.limit) : '10',
      scope: options.scope,
      companyId: options.companyId,
    },
    token
  )
}

export function fetchCompany(token: string, id: string) {
  return apiGet<CompanyRecord>(`/company/${id}`, {}, token)
}

export function fetchCertificateStatus(token: string, id: string) {
  return apiGet<CertificateStatus>(`/company/${id}/certificate-status`, {}, token)
}

function buildCompanyForm(payload: CompanyPayload): FormData {
  const form = new FormData()
  const { address, certificate_file: certificateFile, logo_file: logoFile, ...scalars } = payload

  for (const [key, value] of Object.entries(scalars)) {
    if (value === undefined || value === '') continue
    if (typeof value === 'boolean') {
      form.append(key, value ? 'true' : 'false')
      continue
    }
    form.append(key, String(value))
  }

  if (address) {
    for (const [key, value] of Object.entries(address)) {
      if (value) form.append(`address[${key}]`, String(value))
    }
  }

  if (certificateFile) form.append('certificate_file', certificateFile)
  if (logoFile) form.append('file', logoFile)

  return form
}

export function createCompany(token: string, payload: CompanyPayload) {
  return apiPostForm<CompanyRecord>('/company', buildCompanyForm(payload), token)
}

export function updateCompany(token: string, id: string, payload: CompanyPayload) {
  return apiPutForm<CompanyRecord>(`/company/${id}`, buildCompanyForm(payload), token)
}
