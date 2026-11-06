import { apiDownload, apiGet, apiPost } from './api'

export interface SpedAccountant {
  name: string
  cpf: string
  crc: string
  cnpj: string
  zip_code: string
  address: string
  number: string
  complement: string
  district: string
  phone: string
  email: string
  code_ibge: string
}

export interface SpedFiscalPayload {
  company_id: string
  month: string
  profile: 'A' | 'B' | 'C'
  activity: 0 | 1
  purpose: 0 | 1
  inventory_date?: string
  accountant: SpedAccountant
  previous_credit_balance?: number
  revenue_code?: string
  due_date?: string
}

export interface SpedFiscalSummary {
  regime: 'simples' | 'normal'
  outputs: { nfe: number; nfce: number; cancelled: number; total: number }
  inputs: { notes: number; total: number; withoutXml: number }
  inventory: { items: number; total: number } | null
  icms: { debits: number; credits: number; toPay: number; creditToCarry: number }
  lines: number
  warnings: string[]
}

export interface SpedFiscalResult {
  id: string
  file_name: string
  content_base64: string
  summary: SpedFiscalSummary
}

export const EMPTY_ACCOUNTANT: SpedAccountant = {
  name: '',
  cpf: '',
  crc: '',
  cnpj: '',
  zip_code: '',
  address: '',
  number: '',
  complement: '',
  district: '',
  phone: '',
  email: '',
  code_ibge: '',
}

export function generateSpedFiscal(token: string, payload: SpedFiscalPayload) {
  return apiPost<SpedFiscalResult>('/sped-fiscal/generate', payload, token)
}

// O arquivo vem em ISO-8859-1 (exigência do PVA): baixa os bytes como estão, sem reconverter.
export function downloadSpedFile(result: SpedFiscalResult) {
  const binary = atob(result.content_base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  const url = URL.createObjectURL(new Blob([bytes], { type: 'text/plain;charset=iso-8859-1' }))
  const link = document.createElement('a')
  link.href = url
  link.download = result.file_name
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

// Dados do contador ficam salvos neste navegador, por empresa, para não digitar todo mês.
export function loadSavedAccountant(companyId: string): SpedAccountant {
  try {
    const raw = localStorage.getItem(`c2_sped_accountant:${companyId}`)
    return raw ? { ...EMPTY_ACCOUNTANT, ...JSON.parse(raw) } : EMPTY_ACCOUNTANT
  } catch {
    return EMPTY_ACCOUNTANT
  }
}

export function saveAccountant(companyId: string, accountant: SpedAccountant) {
  try {
    localStorage.setItem(`c2_sped_accountant:${companyId}`, JSON.stringify(accountant))
  } catch {
    // Sem armazenamento local (aba anônima): só não lembra na próxima vez.
  }
}

export interface SpedFiscalFile {
  id: string
  month: string
  file_name: string
  file_size: number
  summary: SpedFiscalSummary | null
  origin: 'manual' | 'auto'
  generated_by_name: string | null
  created_at: string
}

export function fetchSpedFiles(token: string, companyId: string) {
  return apiGet<SpedFiscalFile[]>('/sped-fiscal/files', { company_id: companyId }, token)
}

export function downloadStoredSped(token: string, companyId: string, file: SpedFiscalFile) {
  return apiDownload(`/sped-fiscal/files/${file.id}/download?company_id=${companyId}`, token, file.file_name)
}
