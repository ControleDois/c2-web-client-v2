import { apiGet, apiPost, apiPut, apiDelete } from './api'

export type NotificationEventType = 'late' | 'early_leave' | 'absence' | 'incomplete' | 'overtime'

export interface NotificationRecipient {
  name: string
  phone: string
}

export interface NotificationRuleRecord {
  id: string
  module: string
  event_type: NotificationEventType
  enabled: boolean
  whatsapp_id: string | null
  whatsapp?: { id: string; name: string; phone: string } | null
  threshold_minutes: number | null
  recipients: NotificationRecipient[]
}

export interface TimeClockDeviceRecord {
  id: string
  name: string
  brand: string
  status: 'active' | 'inactive'
  ip_address?: string | null
  last_event_at?: string | null
  webhook_token: string
  // Monitor (linha de Controle de Acesso) - REP iDClass não usa este.
  webhook_url: string
  // Agente local (console Delphi) - envia lotes de marcações lidas do AFD.
  agent_url: string
}

export interface TimeClockEnrollmentRecord {
  id: string
  time_clock_device_id: string
  people_id: string
  people_name: string | null
  external_user_id: string
}

export interface TimeClockEventRecord {
  id: string
  people_id: string | null
  people_name: string | null
  // ID interno do REP (PIS/matricula) - so relevante quando people_id e
  // null, pra dar pra vincular sem precisar ir no aparelho descobrir qual e.
  external_user_id: string
  device_id: string
  device_name: string | null
  direction: 'in' | 'out' | 'unknown'
  occurred_at: string
}

export interface TimeClockStatusPerson {
  people_id: string
  people_name: string
  direction: 'in' | 'out' | 'unknown'
  occurred_at: string
}

export interface TimeClockStatusResult {
  inside_count: number
  people: TimeClockStatusPerson[]
}

interface Paginated<T> {
  data: T[]
  meta: { total: number; per_page: number; current_page: number; last_page: number }
}

export function fetchTimeClockDevices(token: string, companyId: string) {
  return apiGet<TimeClockDeviceRecord[]>('/time-clock/devices', { companyId }, token)
}

export function createTimeClockDevice(token: string, companyId: string, name: string) {
  return apiPost<TimeClockDeviceRecord>('/time-clock/devices', { companyId, name }, token)
}

export function updateTimeClockDevice(
  token: string,
  id: string,
  payload: { name?: string; status?: 'active' | 'inactive' }
) {
  return apiPut<TimeClockDeviceRecord>(`/time-clock/devices/${id}`, payload, token)
}

export function deleteTimeClockDevice(token: string, id: string) {
  return apiDelete<{ id: string }>(`/time-clock/devices/${id}`, token)
}

export function fetchTimeClockEnrollments(token: string, companyId: string) {
  return apiGet<TimeClockEnrollmentRecord[]>('/time-clock/enrollments', { companyId }, token)
}

export function createTimeClockEnrollment(
  token: string,
  companyId: string,
  payload: { time_clock_device_id: string; people_id: string; external_user_id: string }
) {
  return apiPost<TimeClockEnrollmentRecord>('/time-clock/enrollments', { companyId, ...payload }, token)
}

export function deleteTimeClockEnrollment(token: string, id: string) {
  return apiDelete<{ id: string }>(`/time-clock/enrollments/${id}`, token)
}

export function fetchTimeClockEvents(
  token: string,
  companyId: string,
  options: { peopleId?: string; page?: number; limit?: number } = {}
) {
  return apiGet<Paginated<TimeClockEventRecord>>(
    '/time-clock/events',
    {
      companyId,
      peopleId: options.peopleId,
      page: options.page ? String(options.page) : '1',
      limit: options.limit ? String(options.limit) : '20',
    },
    token
  )
}

export function fetchTimeClockStatus(token: string, companyId: string) {
  return apiGet<TimeClockStatusResult>('/time-clock/events/status', { companyId }, token)
}

export interface TimeClockDayReport {
  date: string
  weekday: number
  is_work_day: boolean
  punches: { direction: string; occurred_at: string }[]
  first_in: string | null
  last_out: string | null
  worked_minutes: number
  expected_minutes: number
  balance_minutes: number
  status: 'ok' | 'absence' | 'incomplete' | 'day_off_worked'
  late_minutes: number
  early_leave_minutes: number
  overtime_minutes: number
  shortfall_minutes: number
  observations: string[]
}

export interface TimeClockEmployeeReport {
  people_id: string
  people_name: string
  schedule: {
    work_days: number[]
    start_time: string
    end_time: string
    lunch_break_minutes: number
    tolerance_minutes: number
    expected_daily_minutes: number
    salary_type: 'monthly' | 'hourly' | null
    salary_value: number | null
    is_custom: boolean
  }
  days: TimeClockDayReport[]
  summary: {
    worked_minutes: number
    expected_minutes: number
    balance_minutes: number
    overtime_minutes: number
    shortfall_minutes: number
    work_days_count: number
    absence_days: number
    late_days: number
    early_leave_days: number
    incomplete_days: number
    day_off_worked_days: number
  }
}

export interface TimeClockPayrollRow {
  people_id: string
  people_name: string
  salary_type: 'monthly' | 'hourly' | null
  salary_value: number | null
  hourly_rate: number
  worked_minutes: number
  expected_minutes: number
  overtime_minutes: number
  shortfall_minutes: number
  overtime_percent: number
  overtime_pay: number
  absence_discount: number
  base_pay: number
  total_pay: number
  absence_discount_enabled: boolean
  notes: string[]
}

export function fetchTimeClockReport(
  token: string,
  companyId: string,
  options: { startDate: string; endDate: string; peopleId?: string }
) {
  return apiGet<{ data: TimeClockEmployeeReport[] }>(
    '/time-clock/report',
    { companyId, startDate: options.startDate, endDate: options.endDate, peopleId: options.peopleId },
    token
  )
}

export function fetchTimeClockPayroll(
  token: string,
  companyId: string,
  options: { startDate: string; endDate: string; peopleId?: string }
) {
  return apiGet<{ data: TimeClockPayrollRow[] }>(
    '/time-clock/payroll',
    { companyId, startDate: options.startDate, endDate: options.endDate, peopleId: options.peopleId },
    token
  )
}

export function fetchNotificationRules(token: string, companyId: string) {
  return apiGet<NotificationRuleRecord[]>('/time-clock/notification-rules', { companyId, module: 'time_clock' }, token)
}

export function createNotificationRule(
  token: string,
  companyId: string,
  payload: {
    event_type: NotificationEventType
    enabled?: boolean
    whatsapp_id?: string
    threshold_minutes?: number
    recipients?: NotificationRecipient[]
  }
) {
  return apiPost<NotificationRuleRecord>(
    '/time-clock/notification-rules',
    { company_id: companyId, module: 'time_clock', ...payload },
    token
  )
}

export function updateNotificationRule(
  token: string,
  id: string,
  payload: {
    enabled?: boolean
    whatsapp_id?: string
    threshold_minutes?: number | null
    recipients?: NotificationRecipient[]
  }
) {
  return apiPut<NotificationRuleRecord>(`/time-clock/notification-rules/${id}`, payload, token)
}

export function deleteNotificationRule(token: string, id: string) {
  return apiDelete<{ id: string }>(`/time-clock/notification-rules/${id}`, token)
}

export function formatMinutes(minutes: number): string {
  const sign = minutes < 0 ? '-' : ''
  const abs = Math.round(Math.abs(minutes))
  const hours = Math.floor(abs / 60)
  const rest = abs % 60
  if (hours <= 0) return `${sign}${rest}min`
  if (rest === 0) return `${sign}${hours}h`
  return `${sign}${hours}h${String(rest).padStart(2, '0')}`
}
