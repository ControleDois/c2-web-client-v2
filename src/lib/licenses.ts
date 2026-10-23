import { apiGet, apiPatch, apiPost, apiPut } from './api'

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
  // Plano vinculado (a compra online preenche; a matriz também pode escolher).
  plan_id?: string | null
  plan_cycle?: string | null
  people: LicenseCompanyPeople | null
  createdAt?: string
  has_delphi_key?: boolean
  // Cobrança vinculada à licença (a próxima em aberto do cliente).
  license_bill?: { amount: number; date_due: string; status?: number } | null
}

// Conta a receber da matriz vinculada à cobrança da licença do cliente.
export interface LicenseBillSummary {
  id: string
  code?: number
  name: string
  amount: number
  date_due: string
  status?: number
  people_name?: string | null
  boleto_provider?: string | null
  boleto_pdf_url?: string | null
  boleto_linha_digital?: string | null
  pix_copia_e_cola?: string | null
}

export interface LicenseCompanyDetail extends LicenseCompanyRecord {
  delphiKey: LicenseDelphiKey | null
  license_bill: LicenseBillSummary | null
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

export type LicenseSummaryFilter = 'overdue' | 'expiring' | 'billed' | 'delphi' | 'all'

export type LicenseSummary = Record<LicenseSummaryFilter, { count: number; total: number }>

export function fetchLicenseSummary(token: string, search?: string) {
  return apiGet<LicenseSummary>('/license/summary', { search }, token)
}

export interface GenerateLicenseBillsPayload {
  simulate: boolean
  until: string
  due_day: number
  min_expiry: string
  category_id: string
  bank_account_id?: string | null
}

export interface LicenseBillingRow {
  company_id: string
  name: string
  monthly_fee: number
  expires_on: string | null
  first_due: string | null
  last_due: string | null
  to_create: number
  already_exists: number
  total_to_create: number
  skipped: string | null
}

export interface GenerateLicenseBillsResult {
  simulate: boolean
  created: number
  totals: { clients: number; bills: number; amount: number; skipped: number }
  rows: LicenseBillingRow[]
}

export function generateLicenseBills(token: string, payload: GenerateLicenseBillsPayload) {
  return apiPost<GenerateLicenseBillsResult>('/license/generate-bills', payload, token)
}

export function fetchLicenseCompanies(
  token: string,
  options: { search?: string; page?: number; limit?: number; filter?: LicenseSummaryFilter | null } = {}
) {
  return apiGet<Paginated<LicenseCompanyRecord>>(
    '/license/companies',
    {
      search: options.search,
      page: options.page ? String(options.page) : '1',
      limit: options.limit ? String(options.limit) : '20',
      filter: options.filter ?? undefined,
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
  regenerate_delphi_key?: boolean
  monthly_fee?: number | null
  commission_percent?: number | null
  representative_user_id?: string | null
  license_bill_id?: string | null
  plan_id?: string | null
  plan_cycle?: 'monthly' | 'yearly'
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

// Contas a receber em aberto da matriz, para vincular à cobrança de uma licença.
export function searchLicenseBills(token: string, search: string) {
  return apiGet<LicenseBillSummary[]>('/license/candidate-bills', { search }, token)
}

// Quantos dias antes do vencimento o cliente começa a ser avisado (configuração da matriz).
export function fetchLicenseSettings(token: string) {
  return apiGet<{ warning_days: number }>('/license/settings', {}, token)
}

export function saveLicenseSettings(token: string, warningDays: number) {
  return apiPut<{ warning_days: number }>('/license/settings', { warning_days: warningDays }, token)
}

// Aviso da cobrança da licença no sistema do cliente (boleto e PIX para pagar na hora).
export interface LicenseNotice {
  show: boolean
  state: 'due_soon' | 'due_today' | 'overdue' | null
  days_left: number | null
  due_date: string | null
  amount: number | null
  bill_name: string | null
  warning_days: number
  blocked: boolean
  boleto: {
    provider: string | null
    pdf_url: string | null
    digitable_line: string | null
    barcode: string | null
    pix_copy_paste: string | null
  } | null
}

export function fetchLicenseNotice(token: string, companyId: string) {
  return apiGet<LicenseNotice>('/license/notice', { companyId }, token)
}
