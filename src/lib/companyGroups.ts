import { apiGet, apiPost, apiPut, apiDelete } from './api'

export interface CompanyGroupMemberPeople {
  id: string
  name: string
  document?: string | null
}

export interface CompanyGroupMember {
  id: string
  name?: string | null
  social_name?: string | null
  people?: CompanyGroupMemberPeople[] | null
}

export interface SharedDataFlags {
  people?: boolean
  vehicles?: boolean
  products?: boolean
  services?: boolean
  financial?: boolean
  protection?: boolean
}

export interface CompanyGroupRecord {
  id: string
  code?: number
  company_id: string
  name: string
  shared_data?: SharedDataFlags | null
  companies?: CompanyGroupMember[]
  created_at?: string
}

export interface CompanyGroupPayload {
  company_id: string
  name: string
  companies: string[]
  shared_data: SharedDataFlags
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

export const SHARING_OPTIONS: { key: keyof SharedDataFlags; title: string; description: string }[] = [
  { key: 'people', title: 'Pessoas e clientes', description: 'Compartilha o cadastro de pessoas entre as empresas do grupo' },
  { key: 'vehicles', title: 'Veículos', description: 'Compartilha o cadastro de veículos entre as empresas do grupo' },
  { key: 'products', title: 'Produtos', description: 'Compartilha o catálogo de produtos entre as empresas do grupo' },
  { key: 'services', title: 'Serviços', description: 'Compartilha o catálogo de serviços entre as empresas do grupo' },
  { key: 'financial', title: 'Financeiro', description: 'Compartilha categorias e centros de custo entre as empresas do grupo' },
  { key: 'protection', title: 'Proteção veicular', description: 'Compartilha planos e categorias de proteção entre as empresas do grupo' },
]

export function companyGroupMemberName(company: CompanyGroupMember): string {
  const person = company.people?.[0]
  return person?.name || company.social_name || company.name || 'Empresa sem nome'
}

export function fetchCompanyGroups(
  token: string,
  companyId: string,
  options: { search?: string; page?: number; limit?: number } = {}
) {
  return apiGet<Paginated<CompanyGroupRecord>>(
    '/company-group',
    {
      companyId,
      search: options.search,
      page: options.page ? String(options.page) : '1',
      limit: options.limit ? String(options.limit) : '10',
    },
    token
  )
}

export function fetchCompanyGroup(token: string, id: string) {
  return apiGet<CompanyGroupRecord>(`/company-group/${id}`, {}, token)
}

export function createCompanyGroup(token: string, payload: CompanyGroupPayload) {
  return apiPost<CompanyGroupRecord>('/company-group', payload, token)
}

export function updateCompanyGroup(token: string, id: string, payload: CompanyGroupPayload) {
  return apiPut<CompanyGroupRecord>(`/company-group/${id}`, payload, token)
}

export function deleteCompanyGroup(token: string, id: string) {
  return apiDelete<void>(`/company-group/${id}`, token)
}
