import { apiDelete, apiGet, apiPost, apiPut } from './api'

export interface AccountantRecord {
  id: string
  company_id: string
  name: string
  cpf: string
  crc: string
  email: string | null
  phone: string | null
  clients?: number
}

export interface AccountantPayload {
  name: string
  cpf: string
  crc: string
  email?: string
  phone?: string
}

export interface AccountingFirm {
  id: string
  name: string
  document: string
  city: string | null
  state: string | null
  accountants: { id: string; name: string; crc: string }[]
}

export interface AccountingLink {
  id: string
  linked_at: string
  firm: AccountingFirm | null
  accountant: { id: string; name: string; crc: string } | null
}

// ---- Empresa de contabilidade: contadores ----

export function fetchAccountants(token: string, companyId: string) {
  return apiGet<AccountantRecord[]>('/accounting/accountants', { company_id: companyId }, token)
}

export function createAccountant(token: string, companyId: string, payload: AccountantPayload) {
  return apiPost<AccountantRecord>('/accounting/accountants', { company_id: companyId, ...payload }, token)
}

export function updateAccountant(token: string, companyId: string, id: string, payload: AccountantPayload) {
  return apiPut<AccountantRecord>(`/accounting/accountants/${id}`, { company_id: companyId, ...payload }, token)
}

export function deleteAccountant(token: string, companyId: string, id: string) {
  return apiDelete<{ ok: boolean }>(`/accounting/accountants/${id}?company_id=${companyId}`, token)
}

// ---- Empresa cliente: vínculo com a contabilidade ----

export function searchAccountingFirms(token: string, companyId: string, search: string) {
  return apiGet<AccountingFirm[]>('/accounting/firms', { company_id: companyId, search }, token)
}

export function fetchAccountingLink(token: string, companyId: string) {
  return apiGet<{ link: AccountingLink | null }>('/accounting/link', { company_id: companyId }, token)
}

export function saveAccountingLink(token: string, companyId: string, accountingCompanyId: string, accountantId: string | null) {
  return apiPut<{ link: AccountingLink | null }>(
    '/accounting/link',
    { company_id: companyId, accounting_company_id: accountingCompanyId, accountant_id: accountantId },
    token
  )
}

export function removeAccountingLink(token: string, companyId: string) {
  return apiDelete<{ link: null }>(`/accounting/link?company_id=${companyId}`, token)
}

export function formatCpf(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 11)
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, (_, a, b, c, e) => `${a}.${b}.${c}${e ? `-${e}` : ''}`)
}

export function formatCnpj(value: string) {
  const d = value.replace(/\D/g, '')
  return d.length === 14 ? d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5') : value
}
