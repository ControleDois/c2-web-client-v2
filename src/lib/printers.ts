import { apiGet, apiPost, apiPut, apiDelete } from './api'

export interface Paginated<T> {
  data: T[]
  meta?: { total: number; per_page: number; current_page: number; last_page: number }
}

export const PRINTER_ENCODINGS: { value: string; label: string }[] = [
  { value: 'cp850', label: 'CP850 (padrão — acentos do português)' },
  { value: 'cp1252', label: 'Windows-1252' },
  { value: 'utf8', label: 'UTF-8' },
]

export const PRINTER_COLUMN_OPTIONS: { value: number; label: string }[] = [
  { value: 48, label: '48 colunas — bobina 80 mm' },
  { value: 42, label: '42 colunas — bobina 80 mm (fonte maior)' },
  { value: 32, label: '32 colunas — bobina 58 mm' },
]

export interface PrinterRecord {
  id: string
  code?: number
  name: string
  path: string
  paper_columns: number
  encoding: string
  cut_paper: boolean
  open_drawer: boolean
  copies: number
  active: boolean
  // Servidor de impressão (computador) responsável; vazio = qualquer um da empresa.
  print_agent_id?: string | null
}

export type PrinterPayload = Omit<PrinterRecord, 'id' | 'code'> & { company_id: string }

export interface PrintAgentRecord {
  id: string
  hostname: string
  agent_version?: string | null
  ip_address?: string | null
  last_seen_at?: string | null
  online: boolean
  detected_printers: string[]
}

export const PRINT_JOB_STATUS_LABELS: Record<number, string> = {
  0: 'Na fila',
  1: 'Imprimindo',
  2: 'Impresso',
  3: 'Erro',
  4: 'Cancelado',
}

export interface PrintJobRecord {
  id: string
  code?: number
  printer_id: string
  printer?: { id: string; name: string } | null
  type: string
  title?: string | null
  copies: number
  status: number
  attempts: number
  error?: string | null
  printed_at?: string | null
  created_at?: string
}

// Documento de impressão: o servidor de impressão converte em ESC/POS
// (colunas, acentos, corte e gaveta ficam por conta da impressora cadastrada).
export interface PrintLine {
  t: 'text' | 'row' | 'hr' | 'qr' | 'barcode' | 'feed' | 'cut' | 'drawer'
  v?: string
  l?: string
  r?: string
  c?: string
  n?: number
  align?: 'left' | 'center' | 'right'
  bold?: boolean
  underline?: boolean
  size?: number
  height?: number
  type?: string
  partial?: boolean
}

export interface PrintDocument {
  lines: PrintLine[]
}

export function fetchPrinters(
  token: string,
  companyId: string,
  options: { search?: string; page?: number; limit?: number; active?: boolean } = {}
) {
  return apiGet<Paginated<PrinterRecord>>(
    '/printer',
    {
      companyId,
      search: options.search,
      active: options.active ? 'true' : undefined,
      page: options.page ? String(options.page) : '1',
      limit: options.limit ? String(options.limit) : '10',
    },
    token
  )
}
export const fetchPrinter = (token: string, id: string) => apiGet<PrinterRecord>(`/printer/${id}`, {}, token)
export const createPrinter = (token: string, payload: PrinterPayload) => apiPost<PrinterRecord>('/printer', payload, token)
export const updatePrinter = (token: string, id: string, payload: PrinterPayload) => apiPut<PrinterRecord>(`/printer/${id}`, payload, token)
export const deletePrinter = (token: string, id: string) => apiDelete<void>(`/printer/${id}`, token)
export const testPrinter = (token: string, id: string) => apiPost<PrintJobRecord>(`/printer/${id}/test`, {}, token)

export const fetchPrintAgents = (token: string, companyId: string) =>
  apiGet<PrintAgentRecord[]>('/print-agent', { companyId }, token)

export const fetchPrintJobs = (token: string, companyId: string, limit = 10) =>
  apiGet<Paginated<PrintJobRecord>>('/print-job', { companyId, limit: String(limit) }, token)
export const retryPrintJob = (token: string, id: string) => apiPost<PrintJobRecord>(`/print-job/${id}/retry`, {}, token)
// Reimprime: cria uma impressão nova igual à original (opcionalmente em outra impressora).
export const reprintPrintJob = (token: string, id: string, printerId?: string) =>
  apiPost<PrintJobRecord>(`/print-job/${id}/reprint`, { printer_id: printerId }, token)
export const cancelPrintJob = (token: string, id: string) => apiPost<PrintJobRecord>(`/print-job/${id}/cancel`, {}, token)

export const createPrintJob = (
  token: string,
  payload: { company_id: string; printer_id: string; title?: string; payload?: PrintDocument; type?: 'document' | 'pdf'; source_url?: string; copies?: number }
) => apiPost<PrintJobRecord>('/print-job', payload, token)

export interface PrintAgentPackageInfo {
  available: boolean
  version: string | null
  released_at: string | null
  notes: string | null
  file_size: number | null
  has_token: boolean
  token_created_at: string | null
}

export const fetchPrintAgentPackage = (token: string, companyId: string) =>
  apiGet<PrintAgentPackageInfo>('/print-agent/package', { companyId }, token)

export const regeneratePrintAgentToken = (token: string, companyId: string) =>
  apiPost<{ ok: boolean }>('/print-agent/token', { company_id: companyId }, token)
