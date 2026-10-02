import { apiGet, apiPost, apiPut, apiDelete } from './api'

export interface SupportContractPerson {
  id: string
  name: string
  social_name?: string | null
  document?: string | null
  phone?: string | null
}

export interface SupportContractBill {
  id: string
  installment_number?: number
  date_due: string
  amount: number
  status: number
}

export interface SupportContractRecord {
  id: string
  code?: number
  people_id: string
  user_id?: string | null
  category_id?: string | null
  bank_account_id?: string | null
  title: string
  monthly_value: number
  billing_day: number
  form_payment: number
  start_date: string
  status: number
  notes?: string | null
  people?: SupportContractPerson | null
  user?: { id: string; name: string } | null
  bills?: SupportContractBill[]
  created_at?: string
  autentique_id?: string | null
  autentique_public_id?: string | null
  autentique_short_link?: string | null
  meta?: { signed?: boolean }
}

interface Paginated<T> {
  data: T[]
  meta?: { total: number; per_page: number; current_page: number; last_page: number }
}

export const SUPPORT_CONTRACT_STATUS_LABELS: Record<number, string> = {
  0: 'Ativo',
  1: 'Cancelado',
}

export function fetchSupportContracts(
  token: string,
  companyId: string,
  options: { search?: string; status?: number; peopleId?: string; page?: number; limit?: number } = {}
) {
  return apiGet<Paginated<SupportContractRecord>>(
    '/support-contract',
    {
      companyId,
      search: options.search,
      status: options.status !== undefined ? String(options.status) : undefined,
      peopleId: options.peopleId,
      page: options.page ? String(options.page) : '1',
      limit: options.limit ? String(options.limit) : '20',
    },
    token
  )
}

export function fetchSupportContract(token: string, id: string) {
  return apiGet<SupportContractRecord>(`/support-contract/${id}`, {}, token)
}

export interface SupportContractPayload {
  company_id: string
  people_id: string
  user_id?: string
  category_id: string
  bank_account_id?: string
  title: string
  monthly_value: number
  billing_day: number
  form_payment: number
  start_date: string
  notes?: string
  occurrences?: number
}

export function createSupportContract(token: string, payload: SupportContractPayload) {
  return apiPost<SupportContractRecord>('/support-contract', payload, token)
}

export function updateSupportContract(
  token: string,
  id: string,
  payload: Partial<SupportContractPayload> & { status?: number }
) {
  return apiPut<SupportContractRecord>(`/support-contract/${id}`, payload, token)
}

export function deleteSupportContract(token: string, id: string) {
  return apiDelete<{ id: string }>(`/support-contract/${id}`, token)
}

export function printSupportContract(token: string, id: string, contractTemplateId?: string) {
  return apiPost<{ url: string; html: string | null; signed?: boolean }>(
    `/support-contract/print-contract/${id}`,
    contractTemplateId ? { contractTemplateId } : {},
    token
  )
}

export function sendSupportContract(
  token: string,
  id: string,
  payload: { contractTemplateId: string; whatsappId?: string }
) {
  return apiPost<{
    fileUrl: string
    contractLink: string
    whatsappQueued: boolean
    whatsappError: string | null
  }>(`/support-contract/send-contract/${id}`, payload, token)
}

export function sendSupportContractLink(token: string, id: string, whatsappId: string) {
  return apiPost<{ message: string; whatsappQueued: boolean }>(
    `/support-contract/send-contract-link/${id}`,
    { whatsappId },
    token
  )
}

export function getContractLink(contract: SupportContractRecord): string {
  return contract.autentique_short_link || ''
}

export interface SignatureEvidence {
  provider: string
  status: number
  signerName?: string | null
  signerEmail?: string | null
  signerPhone?: string | null
  verifiedChannel?: string | null
  verifiedAt?: string | null
  signedAt?: string | null
  selfieUrl?: string | null
  signatureImageUrl?: string | null
  fileUrl?: string | null
  latitude?: number | null
  longitude?: number | null
  locationAccuracy?: number | null
  ipAddress?: string | null
  userAgent?: string | null
}

export function fetchSupportContractSignatureEvidence(token: string, id: string) {
  return apiGet<{ signature: SignatureEvidence | null }>(`/support-contract/${id}/signature-evidence`, {}, token)
}
