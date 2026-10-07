import { apiGet } from './api'

export interface SendHistorySummary {
  total: number
  pending: number
  processing: number
  sent: number
  delivered: number
  read: number
  failed: number
  cancelled: number
  paused: number
}

export interface SendHistoryItem {
  id: string
  code?: number
  status: number
  attempts: number
  last_error?: string | null
  message_type?: string | null
  is_automated: boolean
  text: string
  created_at?: string | null
  scheduled_at?: string | null
  next_attempt_at?: string | null
  sent_at?: string | null
  delivered_at?: string | null
  read_at?: string | null
  failed_at?: string | null
  contact_name?: string | null
  contact_phone?: string | null
  post_title?: string | null
  bill?: { id: string; name: string; amount: number; date_due: string; status: number } | null
}

export interface SendHistoryResponse {
  summary: SendHistorySummary
  data: SendHistoryItem[]
  meta: { total: number; per_page: number; current_page: number; last_page: number }
}

export interface SendHistoryFilters {
  dateStart?: string
  dateEnd?: string
  status?: string
  origin?: string
  search?: string
  page?: number
  limit?: number
}

export interface SendTimelineEvent {
  at: string
  kind: string
  title: string
  detail?: string
  tone: 'ok' | 'info' | 'warn' | 'error'
}

export interface SendHistoryDetail {
  message: {
    id: string
    status: number
    attempts: number
    last_error?: string | null
    text: string
    message_type?: string | null
    is_automated: boolean
    contact_name?: string | null
    contact_phone?: string | null
    post_title?: string | null
    next_attempt_at?: string | null
  }
  timeline: SendTimelineEvent[]
}

export interface BillingRunRecord {
  id: string
  run_date: string
  created_at?: string | null
  rule_label: string
  status: 'created' | 'skipped' | 'error'
  reason?: string | null
  bills_found: number
  messages_created: number
  skipped_without_phone: number
  post_id?: string | null
}

export interface BillingRunsResponse {
  enabled: boolean
  start_time?: string | null
  runs: BillingRunRecord[]
}

export const SEND_STATUS_LABELS: Record<number, string> = {
  0: 'Aguardando',
  1: 'Enviando',
  2: 'Enviada',
  3: 'Entregue',
  4: 'Visualizada',
  5: 'Erro',
  6: 'Cancelada',
  7: 'Pausada',
}

export function fetchSendHistory(token: string, whatsappId: string, filters: SendHistoryFilters) {
  return apiGet<SendHistoryResponse>(
    `/whatsapp/${whatsappId}/send-history`,
    {
      dateStart: filters.dateStart,
      dateEnd: filters.dateEnd,
      status: filters.status,
      origin: filters.origin,
      search: filters.search,
      page: filters.page ? String(filters.page) : '1',
      limit: filters.limit ? String(filters.limit) : '30',
    },
    token
  )
}

export function fetchSendHistoryDetail(token: string, whatsappId: string, messageId: string) {
  return apiGet<SendHistoryDetail>(`/whatsapp/${whatsappId}/send-history/${messageId}`, {}, token)
}

export function fetchBillingRuns(token: string, whatsappId: string, days = 14) {
  return apiGet<BillingRunsResponse>(
    `/whatsapp/${whatsappId}/send-history/billing-runs`,
    { days: String(days) },
    token
  )
}
