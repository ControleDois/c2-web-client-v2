import { apiDownload, apiGet } from './api'

export interface IfoodApiLog {
  id: string
  method: string
  path: string
  merchant_id: string | null
  status_code: number | null
  duration_ms: number | null
  request_body: unknown
  response_body: string | null
  error: string | null
  created_at: string
}

function query(from: string, to: string, extra: Record<string, string> = {}) {
  return { from: from ? new Date(from).toISOString() : undefined, to: to ? new Date(to).toISOString() : undefined, ...extra }
}

export interface IfoodApiLogsResult {
  data: IfoodApiLog[]
  client_id: string | null
  mode: 'production' | 'test'
}

export function fetchIfoodApiLogs(token: string, from: string, to: string) {
  return apiGet<IfoodApiLogsResult>('/ifood/api-logs', { ...query(from, to), limit: '1000' }, token)
}

export function downloadIfoodApiLogs(token: string, from: string, to: string, format: 'txt' | 'csv') {
  const params = new URLSearchParams()
  const q = query(from, to, { format, limit: '5000' })
  Object.entries(q).forEach(([key, value]) => value && params.set(key, value))
  return apiDownload(`/ifood/api-logs?${params.toString()}`, token, `logs-ifood.${format}`)
}
