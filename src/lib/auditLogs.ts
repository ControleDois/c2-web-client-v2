import { apiGet } from './api'

export interface AuditLogChange {
  field: string
  label?: string
  oldValue?: unknown
  newValue?: unknown
}

export interface AuditLogRecord {
  id: string
  code?: number
  company_id?: string
  people_id?: string | null
  people_name?: string | null
  people_email?: string | null
  action: string
  module?: string | null
  entity_type?: string | null
  entity_id?: string | null
  description?: string | null
  method?: string | null
  path?: string | null
  ip?: string | null
  user_agent?: string | null
  status_code?: number | null
  old_values?: Record<string, unknown> | null
  new_values?: Record<string, unknown> | null
  metadata?: { changes?: AuditLogChange[]; [key: string]: unknown } | null
  created_at?: string
  people?: { id: string; name: string; email?: string } | null
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

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  create: 'Criação',
  update: 'Alteração',
  delete: 'Exclusão',
  status_change: 'Mudança de status',
  process: 'Processo',
}

export function auditActionLabel(action: string): string {
  const base = action.replace(/_error$/, '')
  const label = AUDIT_ACTION_LABELS[base] ?? base
  return action.endsWith('_error') ? `${label} (erro)` : label
}

export function fetchAuditLogs(
  token: string,
  companyId: string,
  options: {
    search?: string
    action?: string
    module?: string
    entityType?: string
    peopleId?: string
    dateStart?: string
    dateEnd?: string
    page?: number
    limit?: number
  } = {}
) {
  return apiGet<Paginated<AuditLogRecord>>(
    '/audit-logs',
    {
      companyId,
      search: options.search,
      action: options.action,
      module: options.module,
      entityType: options.entityType,
      peopleId: options.peopleId,
      dateStart: options.dateStart,
      dateEnd: options.dateEnd,
      page: options.page ? String(options.page) : '1',
      limit: options.limit ? String(options.limit) : '20',
    },
    token
  )
}
